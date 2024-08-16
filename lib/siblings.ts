import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export async function vote<T>(
    path: string,
    file: string,
    extract: (content: string, name: string) => T,
) {
    const parent = dirname(path)
    const dir = basename(path)
    const entities = await readdir(parent, { withFileTypes: true })
    const contents = await Promise.all(
        entities
            .filter(entry => entry.isDirectory() && entry.name !== dir)
            .map(async entry => {
                try {
                    const content = await readFile(join(parent, entry.name, file), 'utf-8')
                    return extract(content, entry.name) as T | undefined
                } catch {
                    return undefined as T | undefined
                }
            }),
    )
    const grouped = [
        ...contents.reduce((pv, value) => {
            pv.set(value, (pv.get(value) ?? 0) + 1)
            return pv
        }, new Map<Awaited<T> | undefined, number>()),
    ]
    if (grouped.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return grouped[0]![0]
    }
    if (grouped.length > 3) {
        return
    }
    const [first, second, third] = grouped.sort(([_, x], [__, y]) => y - x)
    if (!first || !second) {
        return
    }
    if (third) {
        if (first[1] > 2 && second[1] === 1 && third[1] === 1) {
            return first[0]
        }
    }
    if (first[1] > 2 && second[1] === 1) {
        return first[0]
    }
    if (first[1] > 4 && second[1] === 2) {
        return first[0]
    }

    return undefined
}
