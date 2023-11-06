#!/usr/bin/env node

import { getSource, load } from '../lib/changes.js'
import { sync } from '../lib/chrono.js'
import { install } from '../lib/npm.js'
import { isSpellingDictionaryFile, spelling } from '../lib/spelling.js'
import { watch } from './lib/compiler.js'
import { consoleReporter } from './lib/consoleReporter.js'

let watcher: { close: () => void }
let lastInput: string[] = []

const cwd = process.cwd()

const changes = await load(cwd)

function start() {
    watcher = watch(async (success, inputFiles, outputFiles) => {
        if (inputFiles.includes('package.json') || inputFiles.includes('package-lock.json')) {
            await installAndRestart()
            return
        }
        if (isSpellingDictionaryFile(inputFiles)) {
            if (await spelling(consoleReporter, cwd, getSource(lastInput))) {
                console.log('🚀  All good 👌')
                await changes.stageComplete('spelling')
            } else {
                console.log('⚠️  Issues found 👆')
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
            )
        ) {
            console.log('🚀  All good 👌')
        } else {
            console.log('⚠️  Issues found 👆')
        }
        console.log()
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
