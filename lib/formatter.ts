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
    return await formatter(reporter, path, files, false, signal)
}

export async function formatFiles(path: string, files: string[]) {
    await formatter(undefined, path, files, true)
}

async function formatter(
    reporter: Reporter | undefined,
    path: string,
    files: string[],
    fix: boolean,
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
    try {
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
            return true
        }
        if (reporter) {
            for (const file of bad) {
                reporter.error('Improperly formatted', file)
            }
        }
        if (fix) {
            await Promise.all(
                bad.map(async file => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const [s, options] = src[files.indexOf(file)]!
                    await writeFile(
                        join(path, file),
                        await format(s, { ...options, filepath: file }),
                    )
                }),
            )
        }
        return false
    } catch {
        return false
    }
}
