#!/usr/bin/env node

// eslint-disable-next-line no-restricted-imports
import { emitKeypressEvents } from 'node:readline'
import whyIsNodeRunning from 'why-is-node-running'
import { getSource, load, restart } from '../lib/changes.js'
import { sync } from '../lib/chrono.js'
import { ensureUnlinked } from '../lib/fs.js'
import { signaled } from '../lib/reporter.js'
import { isSpellingDictionaryFile, spelling } from '../lib/spelling.js'
import { watch } from './lib/compiler.js'
import { consoleReporter } from './lib/console-reporter.js'

let timerRunning = false
startTimer()

let watcher: { close: () => void }
let lastInput: string[] = []

const cwd = process.cwd()

const changes = await load(cwd)

function start(preCompileSuccess: boolean) {
    let lastGood = preCompileSuccess
    watcher = watch(
        consoleReporter,
        cwd,
        isOutput,
        async (success, reload, inputFiles, outputFiles, signal) => {
            startTimer()
            if (
                reload ||
                inputFiles.includes('package.json') ||
                inputFiles.includes('package-lock.json')
            ) {
                await installAndRestart()
                return
            }
            const reporter = signaled(consoleReporter, signal)
            if (!preCompileSuccess) {
                reporter.status('⚠️  Issues found 👆' + timing())
                reporter.done()
                return
            }
            if (isSpellingDictionaryFile(inputFiles)) {
                if ((await spelling(reporter, cwd, getSource(lastInput), signal)) && lastGood) {
                    reporter.status('🚀  All good 👌' + timing())
                    await changes.stageComplete('spelling')
                } else {
                    reporter.status('⚠️  Issues found 👆' + timing())
                    lastGood = false
                }
                reporter.done()
                return
            }
            lastInput = inputFiles
            await cleanUpRenames(outputFiles)
            if (
                await changes.postCompile(
                    consoleReporter,
                    cwd,
                    inputFiles,
                    Promise.resolve(success ? outputFiles : undefined),
                    signal,
                )
            ) {
                reporter.status('🚀  All good 👌' + timing())
                lastGood = true
            } else {
                reporter.status('⚠️  Issues found 👆' + timing())
                lastGood = false
            }
            reporter.done()
        },
    )
}

function startTimer() {
    if (timerRunning) {
        return
    }
    timerRunning = true
    performance.mark('build-start')
}

function timing() {
    performance.mark('build-end')
    timerRunning = false
    const m = performance.measure('build', 'build-start', 'build-end')
    return ` (${m.duration.toFixed(6)} ms)`
}

let createdFiles: string[] | undefined

async function cleanUpRenames(outputFiles: string[] | undefined) {
    if (!outputFiles) {
        return
    }
    if (!createdFiles) {
        createdFiles = [...outputFiles]
        return
    }
    const gone = createdFiles.filter(created => !outputFiles.includes(created))
    createdFiles = [...outputFiles]
    await Promise.all(gone.map(ensureUnlinked))
}

function isOutput(file: string) {
    if (!createdFiles) {
        return false
    }
    return createdFiles.includes(file)
}

async function installAndRestart() {
    watcher.close()
    await changes.clearStages()
    const preCompileSuccess = await changes.preCompile(consoleReporter, cwd)
    start(preCompileSuccess)
}

const [preCompileSuccess] = await Promise.all([changes.preCompile(consoleReporter, cwd), sync()])
start(preCompileSuccess)

if (process.stdin.isTTY) {
    emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)

    const closer = (message: string) => () => {
        console.log(message)
        watcher.close()
        process.removeListener('SIGHUP', hub)
        process.removeListener('SIGINT', int)
        process.stdin.removeListener('keypress', keys)
        process.stdin.setRawMode(false)

        const handle = setTimeout(() => {
            clearTimeout(handle)
            setImmediate(() => {
                whyIsNodeRunning()
                process.exit(0)
            })
        }, 5000)
    }
    const hub = closer('Hopping')
    const int = closer('Interrupting')
    const keys = handleKeyPress(async ({ name, shift, meta, ctrl }) => {
        console.log(
            `${shift ? 'SHIFT+' : ''}${meta ? 'META+' : ''}${ctrl ? 'CTRL+' : ''}${name.toUpperCase()}`,
        )
        if (!shift && !meta && !ctrl && name === 'r') {
            watcher.close()
            start(await changes.preCompile(consoleReporter, cwd))
        }

        if (shift && !meta && !ctrl && name === 'r') {
            closer('Restarting')()
            await changes.clearStages()
            await restart()
        }

        if (!shift && !meta && ctrl && name === 'c') {
            closer('Quitting')()
        }
    })
    process.addListener('SIGHUP', hub)
    process.addListener('SIGINT', int)
    process.stdin.addListener('keypress', keys)
}

type Key = { name: string; ctrl: boolean; meta: boolean; shift: boolean }
function handleKeyPress(fn: (key: Key) => Promise<void>) {
    return (_: unknown, key: Key) => {
        fn(key).catch((e: unknown) => {
            console.error('Error handling keypress:')
            console.error(e)
        })
    }
}
