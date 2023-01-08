import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import prettier from 'prettier'
import type { Reporter } from './reporter.js'

export async function formatted(reporter: Reporter, path: string, files: string[]) {
    const src = await Promise.all(
        files.map(file =>
            Promise.all([
                readFile(join(path, file)),
                prettier.resolveConfig(join(path, file), {
                    config: '.prettierrc.json',
                    editorconfig: true,
                }),
            ]),
        ),
    )
    try {
        const bad = src
            .map(([s, options], ix) =>
                prettier.check(s.toString('utf8'), {
                    ...options,
                    filepath: files[ix],
                })
                    ? undefined
                    : relative(process.cwd(), files[ix] ?? ''),
            )
            .filter(file => !!file)
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
