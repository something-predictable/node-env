import { readFile, readdir, rmdir, stat, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { run } from 'node:test'
import { spec as Spec } from 'node:test/reporters'
import { setTimeout } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { Reporter } from './reporter.js'

const exampleTestDir = join('example', 'test')

export function isTest(file: string) {
    const dirName = dirname(file)
    return dirName === 'test' || dirName === exampleTestDir
}

export async function test(
    reporter: Reporter,
    path: string,
    testFiles: string[],
    changed: string[],
    signal: AbortSignal,
) {
    if (changed.length === 0) {
        return true
    }
    const runOnlyChangedTests = changed.every(isTest)
    if (runOnlyChangedTests) {
        testFiles = testFiles.filter(file =>
            changed.includes(join(dirname(file), basename(file, '.js') + '.ts')),
        )
    }
    const success =
        (await testDirectory(path, 'test', testFiles, signal)) &&
        (await testSubProjectDirectory(path, exampleTestDir, testFiles, signal))

    reporter.done()
    return success
}

async function testDirectory(
    path: string,
    directory: string,
    testFiles: string[],
    signal: AbortSignal,
) {
    testFiles = testFiles.filter(file => dirname(file) === directory)
    if (testFiles.length === 0) {
        return true
    }
    using _ = await prepareRunnerProcesses(path)
    return await runTests(path, directory, testFiles, signal)
}

async function testSubProjectDirectory(
    path: string,
    directory: string,
    testFiles: string[],
    signal: AbortSignal,
) {
    testFiles = testFiles.filter(file => dirname(file) === directory)
    if (testFiles.length === 0) {
        return true
    }
    using _ = prepareSubProjectRunnerProcesses(join(path, directory, '..'))
    return await runTests(path, directory, testFiles, signal)
}

async function runTests(path: string, directory: string, testFiles: string[], signal: AbortSignal) {
    const testsStream = run({ files: testFiles, concurrency: true, signal })

    let success = true
    const resultFiles = new Map<string, Promise<void>>()
    testsStream.on('test:start', data => {
        resultFiles.set(data.name, deleteResults(path, directory, data.name, undefined))
    })
    testsStream.on('test:pass', data => {
        resultFiles.set(
            data.name,
            deleteResults(path, directory, data.name, resultFiles.get(data.name)),
        )
    })
    testsStream.on('test:fail', () => {
        success = false
    })

    await pipeline([testsStream, new Spec(), process.stdout], { signal, end: false })

    await Promise.all(resultFiles.values())

    return success
}

async function deleteResults(
    path: string,
    directory: string,
    testName: string,
    waitFor: Promise<void> | undefined,
) {
    if (waitFor) {
        await waitFor
        const testDumpingResults = setTimeout(1000)
        await testDumpingResults
    }
    const resultDirectory = join(path, directory, 'results')
    try {
        const resultFiles = await readdir(resultDirectory)
        await Promise.all(
            resultFiles
                .filter(name => basename(name).startsWith(testName))
                .map(async name => {
                    try {
                        await unlink(join(resultDirectory, name))
                    } catch (e) {
                        if (isFileNotFound(e)) {
                            return
                        }
                        throw e
                    }
                }),
        )
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
    const resultFiles = await readdir(resultDirectory)
    if (resultFiles.length === 0) {
        try {
            await rmdir(resultDirectory)
        } catch (e) {
            if (isFileNotFound(e)) {
                return
            }
            if ((e as { code: unknown }).code === 'ENOTEMPTY') {
                return
            }
            throw e
        }
    }
}

async function prepareRunnerProcesses(path: string) {
    const hooks = await getHooks(path)
    const opts = process.env.NODE_OPTIONS
    process.env.NODE_OPTIONS = [
        ...(opts ? [opts] : []),
        '--enable-source-maps',
        '--trace-warnings',
        ...hooks.map(h => `--import "${h}"`),
    ].join(' ')
    return {
        [Symbol.dispose]: () => {
            if (opts === undefined) {
                delete process.env.NODE_OPTIONS
            } else {
                process.env.NODE_OPTIONS = opts
            }
        },
    }
}

function prepareSubProjectRunnerProcesses(path: string) {
    const hooks = [
        '@riddance/env/lib/test-import.js',
        '@riddance/env/lib/sub-project-test-import.js',
    ]
    const opts = process.env.NODE_OPTIONS
    process.env.NODE_OPTIONS = [
        ...(opts ? [opts] : []),
        '--enable-source-maps',
        '--trace-warnings',
        '--experimental-import-meta-resolve',
        ...hooks.map(h => `--import "${import.meta.resolve(h)}"`),
    ].join(' ')
    process.env.RIDDANCE_SUB_PROJECT_URL = pathToFileURL(path).href + '/'
    return {
        [Symbol.dispose]: () => {
            if (opts === undefined) {
                delete process.env.NODE_OPTIONS
            } else {
                process.env.NODE_OPTIONS = opts
            }
        },
    }
}

export async function writeTestConfig(_path: string) {}

async function getHooks(path: string) {
    const { name, dependencies } = JSON.parse(
        await readFile(join(path, 'package.json'), 'utf-8'),
    ) as {
        name: string
        dependencies?: { [p: string]: unknown }
    }
    if (!dependencies) {
        return []
    }
    const hooks = await getMockHooks(path, dependencies)
    hooks.push(
        name === '@riddance/env' ? './lib/test-import.js' : '@riddance/env/lib/test-import.js',
    )
    return hooks
}

export async function getMockHooks(path: string, dependencies: { [p: string]: unknown }) {
    return (
        await Promise.all(
            Object.entries(dependencies).map(async ([dependency, ref]) => {
                try {
                    const { mock } = (await loadPackageJson(path, dependency, ref)) as {
                        mock: string
                    }
                    if (!mock) {
                        return ''
                    }
                    return `${dependency}/${mock}`
                } catch (e) {
                    if ((e as { code?: string }).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
                        return ''
                    }
                    ;(e as { dependency: string }).dependency = dependency
                    throw e
                }
            }),
        )
    ).filter(h => !!h)
}

async function loadPackageJson(path: string, dependency: string, ref: unknown) {
    return JSON.parse(
        await readFile(await resolvePackageJsonPath(path, dependency, ref), 'utf-8'),
    ) as unknown
}

async function resolvePackageJsonPath(path: string, dependency: string, ref: unknown) {
    try {
        new URL(ref as string)
    } catch (e) {
        if (typeof ref === 'string') {
            try {
                const s = await stat(join(path, ref))
                if (s.isDirectory()) {
                    return join(path, ref, 'package.json')
                }
            } catch (_) {
                //
            }
        }
    }
    return join(path, 'node_modules', dependency, 'package.json')
}

function isFileNotFound(e: unknown) {
    return (e as { code: unknown }).code === 'ENOENT'
}
