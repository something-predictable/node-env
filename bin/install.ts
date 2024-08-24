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

const packageJson = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8')) as {
    devDependencies?: { '@riddance/env'?: string }
}
const isAlreadyInstalled = !!packageJson.devDependencies?.['@riddance/env']

await setup(targetDir)

if (isAlreadyInstalled) {
    if (await isCodeClean(targetDir)) {
        const fixed = await fixLints(targetDir, ['**/*.ts'])
        if (fixed.length !== 0) {
            await formatFiles(targetDir, fixed)
            console.error('Fixes applied, please review carefully.')
        }
    }
}
