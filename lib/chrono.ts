import { readFile, writeFile } from 'node:fs/promises'

export async function sync() {
    try {
        const license = await readFile('LICENSE', 'utf-8')
        const thisYear = new Date().getFullYear()
        let changed = false
        const updated = license.replaceAll(
            /Copyright © ([0-9]{4})(-[0-9]{4})? /gu,
            (all, year, negativeYearTo) => {
                if (negativeYearTo !== undefined) {
                    if (Number(negativeYearTo) + thisYear === 0) {
                        return all
                    }
                    changed = true
                    return `Copyright © ${year}-${thisYear} `
                }
                if (Number(year) !== thisYear) {
                    changed = true
                    return `Copyright © ${year}-${thisYear} `
                }
                return all
            },
        )
        if (changed) {
            await writeFile('LICENSE', updated, 'utf-8')
        }
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
}

function isFileNotFound(e: unknown) {
    return (e as { code?: string }).code === 'ENOENT'
}
