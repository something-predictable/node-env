import { exec } from 'node:child_process'
import { Reporter } from './reporter.js'

export async function install(reporter: Reporter, path: string) {
    reporter.status('Updating packages...')
    const exitCode = await new Promise<number | null>((resolve, reject) => {
        const proc = exec('npm install --no-optional', { cwd: path }, err => {
            if (err) {
                reject(err)
            }
            proc.stdout?.pipe(process.stdout)
            proc.stderr?.pipe(process.stderr)
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
        proc.addListener('error', onError)
        proc.addListener('exit', onExit)
    })
    reporter.status('Packages updated.')
    return exitCode === 0
}
