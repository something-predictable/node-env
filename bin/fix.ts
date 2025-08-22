#!/usr/bin/env node

import { Glob } from 'glob'
import { resolve } from 'node:path'
import { getSource } from '../lib/changes.js'
import { formatFiles } from '../lib/formatter.js'
import { fixLints } from '../lib/linter.js'

const path = resolve(process.cwd(), process.argv[2] ?? '.')
const glob = new Glob('**/*.ts', { cwd: path, ignore: ['node_modules/**', '**/*.d.ts'] })
const files = await glob.walk()
const sourceFiles = getSource(files.map(f => resolve(path, f)))

await fixLints(path, ['**/*.ts'])
const fixed = await formatFiles(
    path,
    sourceFiles.map(f => f.replace(path + '/', '')),
)

if (fixed.length !== 0) {
    console.log('Files fixed: ' + fixed.join(', '))
}
