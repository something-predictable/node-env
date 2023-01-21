#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { push, pushTags, tag } from '../lib/git.js'

const p = resolve(process.cwd(), process.argv[2] ?? '.')

const packageJson = JSON.parse(await readFile(join(p, 'package.json'), 'utf-8')) as {
    version: string
    gitHead: string
}

await tag(p, 'v' + packageJson.version)

const { gitHead, ...headless } = packageJson
await writeFile(join(p, 'package.json'), JSON.stringify(headless, undefined, '  ') + '\n', 'utf-8')

await push(p)
await pushTags(p)
