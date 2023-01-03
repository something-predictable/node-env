import { ChildProcess, spawn, SpawnOptions } from 'node:child_process'
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
        proc = spawn(
            'node',
            [
                'node_modules/mocha/bin/mocha.js',
                '--parallel',
                '--jobs',
                '128',
                '--require',
                'source-map-support/register',
                ...testFiles,
            ],
            options,
        )
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
