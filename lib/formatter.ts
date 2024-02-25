import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { check, resolveConfig } from 'prettier'
import type { Reporter } from './reporter.js'

export async function formatted(
    reporter: Reporter,
    path: string,
    files: string[],
    signal: AbortSignal,
) {
    const src = await Promise.all(
        files.map(file =>
            Promise.all([
                readFile(join(path, file)),
                resolveConfig(join(path, file), {
                    config: '.prettierrc.json',
                    editorconfig: true,
                }),
            ]),
        ),
    )
    if (signal.aborted) {
        return false
    }
    try {
        const bad = (
            await Promise.all(
                src.map(([s, options], ix) =>
                    check(s.toString('utf8'), {
                        ...options,
                        filepath: files[ix],
                    }),
                ),
            )
        )
            .map((s, ix) => (s ? undefined : relative(process.cwd(), files[ix] ?? '')))
            .filter(s => s !== undefined)
        if (bad.length !== 0) {
            for (const file of bad) {
                reporter.error('Improperly formatted', file)
            }
            return false
        }
        return true
    } catch {
        return false
    }
}
