import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setup } from '../lib/env.js'
import { formatFiles } from '../lib/formatter.js'
import { isCodeClean } from '../lib/git.js'
import { fixLints } from '../lib/linter.js'

const targetDir = process.argv[2] ?? process.env.INIT_CWD

if (!targetDir) {
    throw new Error('Please specify target directory.')
}

const { isAlreadyInstalled, myself } = await state(targetDir)
const existing = await setup(targetDir, !isAlreadyInstalled, myself)
if (existing.length !== 0) {
    console.error('Riddance will take ownership of and overwrite the following files:')
    console.error(existing.map(f => `  ./${f}`).join('\n'))
    console.error('Please remove (and stage the removal) before proceeding.')
    process.exit(1)
}

if (isAlreadyInstalled) {
    if (await isCodeClean(targetDir)) {
        const fixed = await fixLints(targetDir, '**/*.ts')
        if (fixed.length !== 0) {
            await formatFiles(targetDir, fixed)
            console.error('Fixes applied, please review carefully.')
        }
    }
}

async function state(path: string) {
    try {
        const packageLockJson = JSON.parse(
            await readFile(join(path, 'package-lock.json'), 'utf-8'),
        ) as {
            name?: string
            packages?: { 'node_modules/@riddance/env'?: unknown }
        }

        return {
            isAlreadyInstalled: !!packageLockJson.packages?.['node_modules/@riddance/env'],
            myself: packageLockJson.name === '@riddance/env',
        }
    } catch {
        try {
            const packageJson = JSON.parse(await readFile(join(path, 'package.json'), 'utf-8')) as {
                name?: string
                devDependencies?: { '@riddance/env'?: string }
            }

            return {
                isAlreadyInstalled: !!packageJson.devDependencies?.['@riddance/env'],
                myself: packageJson.name === '@riddance/env',
            }
        } catch {
            return { isAlreadyInstalled: false, myself: false }
        }
    }
}
