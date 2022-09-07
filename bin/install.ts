import { setup } from './lib/env.js'

const targetDir = process.argv[2] ?? process.env.INIT_CWD

if (!targetDir) {
    throw new Error('Please specify target directory.')
}

await setup(targetDir)
