import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import prettier from 'prettier'
import type { Reporter } from './reporter.js'

export async function formatted(reporter: Reporter, files: string[]) {
    const src = await Promise.all(
        files.map(file =>
            Promise.all([
                readFile(file),
                prettier.resolveConfig(file, {
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
