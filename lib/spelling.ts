import { ValidationIssue, spellCheckFile } from 'cspell-lib'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Reporter } from './reporter.js'

export function isSpellingDictionaryFile(files: string[]) {
    return files.length === 1 && files[0] === 'dictionary.txt'
}

export async function spelling(
    reporter: Reporter,
    path: string,
    files: string[],
    abort: AbortSignal,
) {
    const words = [...commonInducedWords, ...(await readWords(path))]
    const checkFiles = ['package.json', 'example/package.json', ...files]
    const results = await Promise.all(
        checkFiles.map(file =>
            spellCheckFile(
                resolve(path, file),
                { generateSuggestions: false },
                { noConfigSearch: true, words },
            ),
        ),
    )
    if (abort.aborted) {
        return false
    }
    const errors = results.flatMap((r, ix) =>
        (r.errors ?? [])
            .filter(e => !isFileNotFound(e))
            .map(error => ({ file: checkFiles[ix], error })),
    )
    if (errors.length !== 0) {
        for (const e of errors) {
            reporter.fatal('Unexpected error checking spelling.', e.error, e.file)
        }
        return false
    }
    const issues = results.flatMap((r, ix) =>
        r.issues.map((issue: ValidationIssue & { line: { position?: { line: number } } }) => ({
            file: checkFiles[ix],
            issue,
        })),
    )
    if (issues.length !== 0) {
        for (const i of issues) {
            reporter.error(
                i.issue.message ?? 'Unknown word: ' + i.issue.text,
                i.file,
                i.issue.line.position && i.issue.line.position.line + 1,
            )
        }
        return false
    }
    return true
}

const commonInducedWords = ['camelcase', 'postpublish']

async function readWords(dir: string) {
    try {
        const dictionary = await readFile(join(dir, 'dictionary.txt'))
        return dictionary
            .toString('utf-8')
            .split('\n')
            .filter(l => !!l)
            .map(l => l.trim())
    } catch (e) {
        if (isFileNotFound(e)) {
            return []
        }
        throw e
    }
}

function isFileNotFound(e: unknown) {
    return (e as { code: unknown }).code === 'ENOENT'
}
