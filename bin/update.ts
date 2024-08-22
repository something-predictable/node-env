import { update } from '../lib/env.js'
import { formatFiles } from '../lib/formatter.js'
import { isCodeClean } from '../lib/git.js'
import { fixLints } from '../lib/linter.js'

const targetDir = process.argv[2] ?? process.env.INIT_CWD

if (!targetDir) {
    throw new Error('Please specify target directory.')
}

await update(targetDir)

if (await isCodeClean(targetDir)) {
    const fixed = await fixLints(targetDir, ['**/*.ts'])
    if (fixed.length !== 0) {
        await formatFiles(targetDir, fixed)
        console.error('Fixes applied, please review carefully.')
    }
}
