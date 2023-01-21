import { exec } from 'node:child_process'

export async function isClean(path: string) {
    const changes = await execAsync(path, 'git status --short')
    return changes.length === 0
}

export async function getHash(path: string) {
    const [long] = await execAsync(path, 'git rev-parse HEAD')
    return long
}

export async function tag(path: string, t: string) {
    return await execAsync(path, `git tag "${t}"`)
}

export async function getTag(path: string) {
    try {
        const [t] = await execAsync(path, 'git describe --exact-match --tags HEAD')
        return t
    } catch (e) {
        if ((e as { message?: string }).message?.includes('fatal: no tag exactly matches ')) {
            return undefined
        }
        throw e
    }
}

export async function getTags(path: string) {
    return await execAsync(path, 'git tag --list')
}

export async function push(path: string) {
    return await execAsync(path, 'git push')
}

export async function pushTags(path: string) {
    return await execAsync(path, 'git push --tags')
}

function execAsync(path: string, cmd: string) {
    return new Promise<string[]>((resolve, reject) => {
        exec(cmd, { cwd: path }, (err, stdout) => {
            if (err) {
                reject(err)
                return
            }
            resolve(stdout.split('\n').slice(0, -1))
        })
    })
}
