import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const baseUrl = process.env.RIDDANCE_SUB_PROJECT_URL
if (baseUrl) {
    const path = fileURLToPath(baseUrl)
    process.chdir(path)
    const { dependencies } = JSON.parse(await readFile(join(path, 'package.json'), 'utf-8')) as {
        name: string
        dependencies?: { [p: string]: unknown }
    }
    if (dependencies) {
        for (const hook of await getMockHooks(path, dependencies)) {
            await import(import.meta.resolve(hook, baseUrl))
        }
    }
}

async function getMockHooks(path: string, dependencies: { [p: string]: unknown }) {
    return (
        await Promise.all(
            Object.entries(dependencies).map(async ([dependency, ref]) => {
                try {
                    const { mock } = (await loadPackageJson(path, dependency, ref)) as {
                        mock: string
                    }
                    if (!mock) {
                        return ''
                    }
                    return `${dependency}/${mock}`
                } catch (e) {
                    if ((e as { code?: string }).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
                        return ''
                    }
                    ;(e as { dependency: string }).dependency = dependency
                    throw e
                }
            }),
        )
    ).filter(h => !!h)
}

async function loadPackageJson(path: string, dependency: string, ref: unknown) {
    return JSON.parse(
        await readFile(await resolvePackageJsonPath(path, dependency, ref), 'utf-8'),
    ) as unknown
}

async function resolvePackageJsonPath(path: string, dependency: string, ref: unknown) {
    try {
        new URL(ref as string)
    } catch (e) {
        if (typeof ref === 'string') {
            try {
                const s = await stat(join(path, ref))
                if (s.isDirectory()) {
                    return join(path, ref, 'package.json')
                }
            } catch (_) {
                //
            }
        }
    }
    return join(path, 'node_modules', dependency, 'package.json')
}
