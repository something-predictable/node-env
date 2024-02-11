import { ChildProcess, spawn, SpawnOptions } from 'node:child_process'
import { access, constants, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Reporter } from './reporter.js'

let proc: ChildProcess | undefined

export async function test(
    _reporter: Reporter,
    path: string,
    testFiles: string[],
    changed: string[],
) {
    proc?.kill('SIGTERM')
    proc = undefined
    if (changed.length === 0) {
        return true
    }
    if (changed.every(file => dirname(file) === 'test')) {
        testFiles = testFiles.filter(file =>
            changed.includes(join('test', basename(file, '.js') + '.ts')),
        )
    }
    if (testFiles.length === 0) {
        return true
    }
    const options: SpawnOptions = {
        cwd: path,
        stdio: [process.stdin, process.stdout, process.stderr, 'pipe'],
    }
    const exitCode = await new Promise<number | null>((resolve, reject) => {
        proc = spawn('node', ['node_modules/mocha/bin/mocha.js', ...testFiles], options)
        const onError = (error: Error) => {
            reject(error)
            proc?.removeListener('error', onError)
            proc?.removeListener('exit', onExit)
            proc = undefined
        }
        const onExit = (code: number | null) => {
            resolve(code)
            proc?.removeListener('error', onError)
            proc?.removeListener('exit', onExit)
            proc = undefined
        }
        proc.addListener('error', onError)
        proc.addListener('exit', onExit)
    })
    return exitCode === 0
}

export async function writeTestConfig(path: string) {
    await writeFile(
        join(path, '.mocharc.json'),
        JSON.stringify(
            {
                parallel: true,
                jobs: 128,
                require: [await sourceMapSupport(), ...(await getHooks(path))],
            },
            undefined,
            '  ',
        ),
        'utf-8',
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
