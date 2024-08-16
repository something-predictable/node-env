#!/usr/bin/env node

import { resolve } from 'node:path'
import { build } from '../build.js'
import { consoleReporter } from './lib/console-reporter.js'

if (!(await build(consoleReporter, resolve(process.cwd(), process.argv[2] ?? '.')))) {
    process.exit(1)
}
