import { unlink } from 'node:fs/promises'

export async function ensureUnlinked(file: string) {
    try {
        await unlink(file)
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
}

export function isFileNotFound(e: unknown) {
    return (e as { code: unknown }).code === 'ENOENT'
}
