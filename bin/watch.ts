#!/usr/bin/env node

import { getSource, load } from '../lib/changes.js'
import { sync } from '../lib/chrono.js'
import { install } from '../lib/npm.js'
import { signaled } from '../lib/reporter.js'
import { isSpellingDictionaryFile, spelling } from '../lib/spelling.js'
import { watch } from './lib/compiler.js'
import { consoleReporter } from './lib/consoleReporter.js'

let watcher: { close: () => void }
let lastInput: string[] = []

const cwd = process.cwd()

const changes = await load(cwd)

function start() {
    let abort = new AbortController()
    watcher = watch(async (success, inputFiles, outputFiles) => {
        if (inputFiles.includes('package.json') || inputFiles.includes('package-lock.json')) {
            await installAndRestart()
            return
        }
        abort.abort()
        abort = new AbortController()
        const reporter = signaled(consoleReporter, abort.signal)
        if (isSpellingDictionaryFile(inputFiles)) {
            if (await spelling(reporter, cwd, getSource(lastInput), abort.signal)) {
                reporter.status('🚀  All good 👌')
                await changes.stageComplete('spelling')
            } else {
                reporter.status('⚠️  Issues found 👆')
            }
            return
        }
        lastInput = inputFiles
        if (
            await changes.postCompile(
                consoleReporter,
                cwd,
                inputFiles,
                Promise.resolve(success ? outputFiles : undefined),
                abort.signal,
            )
        ) {
            reporter.status('🚀  All good 👌')
        } else if (!abort.signal.aborted) {
            reporter.status('⚠️  Issues found 👆')
        }
        reporter.done()
    })
}

async function installAndRestart() {
    watcher.close()
    await install(consoleReporter, cwd)
    await changes.clearStages()
    start()
}

await Promise.all([changes.preCompile(consoleReporter, cwd), sync()])
start()
