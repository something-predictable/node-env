import { spellCheckFile } from 'cspell-lib/dist/spellCheckFile.js'
import { readFile } from 'node:fs/promises'
import { EOL } from 'node:os'
import { resolve } from 'node:path'

export function isDictionary(files: string[]) {
    return files.length === 1 && files[0] === 'dictionary.txt'
}

export async function spelling(files: string[]) {
    const words = await readWords()
    const dir = process.cwd()
    const results = await Promise.all(
        files.map(file =>
            spellCheckFile(
                resolve(dir, file),
                { generateSuggestions: false },
                { noConfigSearch: true, words },
            ),
        ),
    )
    const errors = results.flatMap(r => r.errors).filter(e => !!e)
    if (errors.length !== 0) {
        errors.forEach(e => console.error(e))
        return false
    }
    const bad = results
        .map((r, ix) =>
            r.issues.length !== 0
                ? `Unknown words in ${files[ix] ?? ''}: ${r.issues
                      .map(i => `"${i.text}"`)
                      .join(',')}`
                : undefined,
        )
        .filter(file => !!file)

    if (bad.length !== 0) {
        console.error(bad.join(EOL))
        return false
    }
    return true
}

async function readWords() {
    try {
        const dictionary = await readFile('dictionary.txt')
        return dictionary
            .toString('utf8')
            .split('\n')
            .filter(l => !!l)
            .map(l => l.trim())
    } catch (e) {
        if (isNotFound(e)) {
            return []
        }
        throw e
    }
}

function isNotFound(e: unknown) {
    return (e as { code?: string }).code === 'ENOENT'
}
