import { spawn, SpawnOptions } from 'node:child_process'
import { access, constants, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
    return await runTests(path, directory, testFiles, signal)
}

async function runTests(path: string, directory: string, testFiles: string[], signal: AbortSignal) {
    const cwd = join(path, directory, '..')
    const exitCode = await spawnNode(
        [
            '--trace-warnings',
            relative(cwd, join(path, 'node_modules/mocha/bin/mocha.js')),
            '--config',
            '.mocharc.json',
            ...testFiles.map(f => relative(cwd, join(path, f))),
        ],
        {
            cwd,
            env: {
                PROJECT_DIRECTORY: process.cwd(),
                ...process.env,
                RIDDANCE_SUB_PROJECT_URL: pathToFileURL(cwd).href,
            },
        },
        signal,
    )
    return exitCode === 0
}

export async function writeTestConfig(path: string, resolver?: (dependency: string) => string) {
    const sourceMapModule = await sourceMapSupport()
    const hooks = await getHooks(path)
    await writeFile(
        join(path, '.mocharc.json'),
        JSON.stringify(
            {
                parallel: true,
                jobs: 128,
                require: [sourceMapModule, ...(resolver ? hooks.map(resolver) : hooks)],
            },
            undefined,
            '  ',
        ),
        'utf-8',
    )

    const subProjectDirectory = join(path, 'example')
    try {
        await access(subProjectDirectory, constants.W_OK)
    } catch {
        return
    }
    const script = relative(
        subProjectDirectory,
        fileURLToPath(import.meta.resolve('./sub-project-tests.js')),
    )
    await spawnNode(
        ['--experimental-import-meta-resolve', script],
        { cwd: subProjectDirectory },
        new AbortController().signal,
    )
}

async function sourceMapSupport() {
    try {
        await access('./lib/source-map-support.ts', constants.R_OK)
        return './lib/source-map-support.js'
    } catch {
        return '@riddance/env/lib/source-map-support.js'
    }
}

async function getHooks(path: string) {
    const { dependencies } = JSON.parse(await readFile(join(path, 'package.json'), 'utf-8')) as {
        dependencies?: { [p: string]: unknown }
    }
    if (!dependencies) {
        return []
    }
    const hooks = await Promise.all(
        Object.keys(dependencies).map(async dependency => {
            const { mock } = JSON.parse(
                await readFile(join(path, 'node_modules', dependency, 'package.json'), 'utf-8'),
            ) as {
                mock: string
            }
            if (!mock) {
                return ''
            }
            return `${dependency}/${mock}`
        }),
    )
    return hooks.filter(h => !!h)
}

function spawnNode(args: readonly string[], options: SpawnOptions, signal: AbortSignal) {
    return new Promise<number | null>((resolve, reject) => {
        const proc = spawn('node', args, {
            ...options,
            stdio: [process.stdin, process.stdout, process.stderr, 'pipe'],
        })
        const killer = () => {
            proc.kill('SIGTERM')
        }
        signal.addEventListener('abort', killer)
        const onError = (error: Error) => {
            reject(error)
            proc.removeListener('error', onError)
            proc.removeListener('exit', onExit)
            signal.removeEventListener('abort', killer)
        }
        const onExit = (code: number | null) => {
            resolve(code)
            proc.removeListener('error', onError)
            proc.removeListener('exit', onExit)
            signal.removeEventListener('abort', killer)
        }
        proc.addListener('error', onError)
        proc.addListener('exit', onExit)
    })
}
