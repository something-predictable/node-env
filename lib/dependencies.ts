import { readFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function dependantPackages(path: string) {
    const { dependencies, devDependencies } = JSON.parse(
        await readFile(join(path, 'package.json'), 'utf-8'),
    ) as {
        dependencies?: { [p: string]: { path: string; packageJson: unknown } }
        devDependencies?: { [p: string]: { path: string; packageJson: unknown } }
    }
    return {
        dependencies: await readPackageJsonFiles(path, dependencies),
        devDependencies: await readPackageJsonFiles(path, devDependencies),
    }
}

async function readPackageJsonFiles(path: string, dependencies?: { [p: string]: unknown }) {
    if (!dependencies) {
        return {}
    }
    const baseUrl = `${pathToFileURL(path).href}/`
    const packages = await Promise.all(
        Object.keys(dependencies).map(async dependency => {
            const packageJson = findPackageJSON(dependency, baseUrl)
            if (!packageJson) {
                return undefined
            }
            return [
                dependency,
                {
                    path: dirname(packageJson),
                    packageJson: JSON.parse(await readFile(packageJson, 'utf-8')) as unknown,
                },
            ] as const
        }),
    )
    return Object.fromEntries(packages.filter(p => !!p))
}
