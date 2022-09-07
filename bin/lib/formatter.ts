import { readFile } from 'node:fs/promises'
import { EOL } from 'node:os'
import { relative } from 'node:path'
import prettier from 'prettier'

export async function formatted(files: string[]) {
    const [options, ...src] = await Promise.all([
        prettier.resolveConfig(process.cwd()),
        ...files.map(file => readFile(file)),
    ])
    try {
        const bad = src
            .map((s, ix) =>
                prettier.check(s.toString('utf8'), { ...options, filepath: files[ix] })
                    ? undefined
                    : '  - ' + relative(process.cwd(), files[ix] ?? ''),
            )
            .filter(file => !!file)
        if (bad.length !== 0) {
            console.error('Improperly formatted:')
            console.error(bad.join(EOL))
            console.error('Consider using an editor with prettier support.')
            console.error()
            return false
        }
        return true
    } catch {
        return false
    }
}
