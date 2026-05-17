#!/usr/bin/env node

import { uninstall } from '../lib/env.js'
import { consoleReporter } from './lib/console-reporter.js'

const targetDir = process.argv[2] ?? process.env.INIT_CWD ?? process.cwd()

if (!targetDir) {
    throw new Error('Please specify target directory.')
}

await uninstall(consoleReporter, targetDir)
