#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from '../build.js'
import { getHash, getTag, getTags, isClean } from '../lib/git.js'
import { consoleReporter } from './lib/consoleReporter.js'

const p = resolve(process.cwd(), process.argv[2] ?? '.')
const packageJson = JSON.parse(await readFile(join(p, 'package.json'), 'utf-8')) as {
    version: string
    gitHead?: string
}

async function assertClean() {
    if (packageJson.gitHead) {
        const { gitHead, ...headless } = packageJson
        await writeFile(
            join(p, 'package.json'),
            JSON.stringify(headless, undefined, '  ') + '\n',
            'utf-8',
        )
    }
    if (!(await isClean(p))) {
        throw new Error('Build does not have a git hash.')
    }
}

async function assertBuildable() {
    if (!(await build(consoleReporter, p))) {
        throw new Error('Not buildable.')
    }
}

async function assertUntagged() {
    const [t, ts] = await Promise.all([getTag(p), getTags(p)])
    const { version } = packageJson

    if (t === `v${version}`) {
        return // Since we're clean
    }
    if (ts.includes(`v${version}`)) {
        throw Error('Version already built. Please update package.json.')
    }
}

try {
    await Promise.all([assertClean(), assertBuildable(), assertUntagged()])
    const gitHead = await getHash(p)
    await writeFile(
        join(p, 'package.json'),
        JSON.stringify(
            {
                ...packageJson,
                gitHead,
            },
            undefined,
            '  ',
        ),
        'utf-8',
    )
} catch (e) {
    console.error((e as { message: string }).message)
    process.exit(1)
}
