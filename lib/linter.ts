import { ESLint } from 'eslint'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'
import { ensureUnlinked } from './fs.js'
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
        const deprecations = results
            .flatMap(r => r.usedDeprecatedRules)
            .map(r =>
                r.replacedBy.length === 0
                    ? `${r.ruleId} deprecated`
                    : `${r.ruleId} deprecated, replaced by ${r.replacedBy.join(',')}`,
            )
        if (deprecations.length !== 0) {
            for (const message of new Set(deprecations)) {
                reporter.error(message)
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
    const [changed, mapping] = await kebabCaseFiles(
        path,
        results.map(r => relative(path, r.filePath)),
    )
    return [...changed, ...fixables.map(r => relative(path, r.filePath))].map(f =>
        mapping.reduce((pv, [, camel, kebab]) => pv.replace(camel, kebab), f),
    )
}

async function kebabCaseFiles(path: string, files: string[]) {
    const ext = '.ts'
    const sourceFiles = files.filter(f => extname(f) === ext)
    const renamed = sourceFiles
        .map(f => [dirname(f), basename(f, ext)] as const)
        .map(([dir, base]) => {
            const kebab = base.replaceAll(
                /[A-Z]+(?![a-z])|[A-Z]/gu,
                ($, ofs) => (ofs ? '-' : '') + $.toLowerCase(),
            )
            return kebab === base ? undefined : ([dir, base, kebab] as const)
        })
        .filter(r => !!r)
    if (renamed.length === 0) {
        return [[] as string[], renamed] as const
    }
    const changed = await Promise.all(sourceFiles.map(f => updateImports(path, f, renamed)))
    await Promise.all([
        ...renamed.map(([p, camel, kebab]) =>
            rename(join(path, p, camel + ext), join(path, p, kebab + ext)),
        ),
        ...renamed.flatMap(([p, camel]) =>
            ['.d.ts', '.js'].map(e => ensureUnlinked(join(path, p, camel + e))),
        ),
    ])
    return [changed.filter(c => c !== undefined), renamed] as const
}

async function updateImports(
    path: string,
    file: string,
    renamed: (readonly [string, string, string])[],
) {
    const fp = join(path, file)
    const text = await readFile(fp, 'utf-8')
    let updated = text
    for (const [, camel, kebab] of renamed) {
        updated = updated.replaceAll(
            new RegExp(`import (.+) from '\\.(.*)/${camel}.js'`, 'gu'),
            (_, i: string, p: string) => `import ${i} from '.${p}/${kebab}.js'`,
        )
    }
    if (updated !== text) {
        await writeFile(fp, updated, 'utf-8')
        return file
    }
    return undefined
}
