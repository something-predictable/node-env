import { ESLint } from 'eslint'
import { relative } from 'node:path'
import { Reporter } from './reporter.js'

export function makeCache(path: string) {
    return new ESLint({ cwd: path, globInputPaths: false })
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

export async function fixLints(path: string, files: string[]) {
    const cache = new ESLint({ cwd: path, fix: true })
    const results = await cache.lintFiles(files)
    const fixables = results.filter(r => r.output)
    if (fixables.length === 0) {
        return []
    }
    await ESLint.outputFixes(results)
    return fixables.map(r => relative(path, r.filePath))
}
