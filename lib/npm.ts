import { exec } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Reporter } from './reporter.js'

export async function install(reporter: Reporter, path: string) {
    reporter.status('Updating packages...')
    const success = (await npmInstall(path)) && (await npmInstall(join(path, 'example')))
    if (success) {
        reporter.status('Packages updated.')
    } else {
        reporter.error('Package install failed.')
    }
    return success
}

async function npmInstall(path: string) {
    try {
        await stat(path)
    } catch (e) {
        if (isFileNotFound(e)) {
            return true
        }
        throw e
    }
    const exitCode = await new Promise<number | null>((resolve, reject) => {
        const proc = exec('npm install --omit=optional', { cwd: path }, err => {
            if (err) {
                reject(err)
            }
        })
        const onError = (error: Error) => {
            reject(error)
            proc.removeListener('error', onError)
            proc.removeListener('exit', onExit)
        }
        const onExit = (code: number | null) => {
            resolve(code)
            proc.removeListener('error', onError)
            proc.removeListener('exit', onExit)
        }
        proc.stderr?.pipe(process.stderr)
        proc.addListener('error', onError)
        proc.addListener('exit', onExit)
    })
    return exitCode === 0
}

function isFileNotFound(e: unknown) {
    return (e as { code: unknown }).code === 'ENOENT'
}
