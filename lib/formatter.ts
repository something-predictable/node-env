import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { check, format, resolveConfig } from 'prettier'
import type { Reporter } from './reporter.js'

export async function formatted(
    reporter: Reporter,
    path: string,
    files: string[],
    signal: AbortSignal,
) {
    try {
        const bad = await formatter(reporter, path, files, signal)
        return bad.length === 0
    } catch {
        return false
    }
}

export async function formatFiles(path: string, files: string[]) {
    const bad = await formatter(undefined, path, files)
    return await Promise.all(
        bad.map(async file => {
            await writeFile(join(path, file.filepath), await format(file.source, file))
            return file.filepath
        }),
    )
}

async function formatter(
    reporter: Reporter | undefined,
    path: string,
    files: string[],
    signal?: AbortSignal,
) {
    const configPath = join(path, '.prettierrc.json')
    const src = await Promise.all(
        files.map(file =>
            Promise.all([
                readFile(join(path, file), 'utf-8'),
                resolveConfig(join(path, file), {
                    config: configPath,
                    editorconfig: true,
                }),
            ]),
        ),
    )
    signal?.throwIfAborted()
    const bad = (
        await Promise.all(
            src.map(([s, options], ix) =>
                check(s, {
                    ...options,
                    filepath: files[ix],
                }),
            ),
        )
    )
        .map((s, ix) => (s ? undefined : relative(process.cwd(), files[ix] ?? '')))
        .filter(s => s !== undefined)
    if (bad.length === 0) {
        return []
    }
    if (reporter) {
        for (const file of bad) {
            reporter.error('Improperly formatted', file)
        }
    }
    return bad.map(file => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const [source, options] = src[files.indexOf(file)]!
        return { source, ...options, filepath: file }
    })
}
