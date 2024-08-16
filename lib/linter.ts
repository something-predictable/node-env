import { ESLint } from 'eslint'
import { relative } from 'node:path'
import { Reporter } from './reporter.js'

export function makeCache(path: string) {
    return new ESLint({ cwd: path })
}

export async function lint(
    reporter: Reporter | undefined,
    path: string,
    files: string[],
    cache: ESLint,
) {
    const results = await cache.lintFiles(files)
    if (reporter) {
        for (const result of results) {
            for (const msg of result.messages) {
                reporter.error(msg.message, relative(path, result.filePath), msg.line, msg.column)
            }
        }
    }
    return !results.some(r => {
        return r.fatalErrorCount + r.errorCount + r.warningCount
    })
}
