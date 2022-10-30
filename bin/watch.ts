#!/usr/bin/env node

import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import { watch } from './lib/compiler.js'
import { formatted } from './lib/formatter.js'
import { clearCache, lint } from './lib/linter.js'
import { install } from './lib/npm.js'
import { isDictionary, spelling } from './lib/spelling.js'
import { test } from './lib/tester.js'

const timestamps = await loadTimestamps()

let watcher: { close: () => void }
let lastInput: string[] = []

function start() {
    watcher = watch(async (success, inputFiles, outputFiles) => {
        if (inputFiles.includes('package.json') || inputFiles.includes('package-lock.json')) {
            await installAndRestart()
            return
        }
        if (isDictionary(inputFiles)) {
            if (await spelling(getSource(lastInput))) {
                console.log('🚀  All good 👌')
                timestamps.stages.spelling = new Date().toISOString()
                await saveTimestamps()
            } else {
                console.log('⚠️  Issues found 👆')
            }
            return
        }
        await setOutputs(outputFiles)
        lastInput = inputFiles
        await postCompile(success, inputFiles, outputFiles)
    })
}

async function installAndRestart() {
    watcher.close()
    await install()
    timestamps.stages = {}
    await clearCache()
    start()
}

async function shouldInstall() {
    const oldestStage =
        Object.values(timestamps.stages)
            .map(d => new Date(d).getTime())
            .sort()
            .at(0) ?? -1
    const latestPackage =
        (await Promise.all(['package.json', 'package-lock.json'].map(f => stat(f))))
            .map(s => s.ctimeMs)
            .sort()
            .at(-1) ?? 0
    return oldestStage < latestPackage
}

if (await shouldInstall()) {
    await install()
    timestamps.stages = {}
}
start()

function getSource(input: string[]) {
    return input.filter(
        f => extname(f) === '.ts' && !f.endsWith('.d.ts') && !dirname(f).includes('node_modules'),
    )
}

async function postCompile(success: boolean, inputFiles: string[], outputFiles: string[]) {
    const source = getSource(inputFiles)
    const tests = outputFiles.filter(f => dirname(f) === 'test' && !f.endsWith('.d.ts'))
    if (
        (
            await Promise.all([
                success,
                ifChanged('formatting', source, formatted),
                ifChanged('spelling', source, spelling),
                ifChanged('linting', source, lint),
                ifChanged('tests', source, changed => test(tests, changed)),
            ])
        ).every(r => r)
    ) {
        console.log('🚀  All good 👌')
    } else {
        console.log('⚠️  Issues found 👆')
    }
    await saveTimestamps()
    console.log()
}

async function ifChanged(stage: string, source: string[], fn: (src: string[]) => Promise<boolean>) {
    const { stages } = timestamps
    if (stages[stage]) {
        const lastSuccess = new Date(timestamps.stages[stage] ?? 0).getTime()
        const stats = await Promise.all(
            source.map(async s => {
                try {
                    return await stat(s)
                } catch (e) {
                    if (isFileNotFound(e)) {
                        return { mtimeMs: 0 }
                    }
                    throw e
                }
            }),
        )
        source = source
            .map((s, ix) => ((stats[ix]?.mtimeMs ?? Number.MAX_VALUE) > lastSuccess ? s : ''))
            .filter(s => !!s)
    }
    if (await fn(source)) {
        stages[stage] = new Date().toISOString()
        return true
    }
    return false
}

interface Timestamps {
    outputs: string[]
    stages: { [stage: string]: string }
}

async function setOutputs(outputs: string[]) {
    for (const old of timestamps.outputs) {
        if (!outputs.includes(old)) {
            try {
                await rm(old)
            } catch (e) {
                if (isFileNotFound(e)) {
                    continue
                }
                throw e
            }
        }
    }
    timestamps.outputs = outputs
}

async function loadTimestamps() {
    try {
        return JSON.parse(await readFile('.timestamps.json', 'utf-8')) as Timestamps
    } catch (e) {
        if (isFileNotFound(e)) {
            return {
                outputs: [],
                stages: {},
            }
        }
        throw e
    }
}

async function saveTimestamps() {
    await writeFile('.timestamps.json', JSON.stringify(timestamps, undefined, '    '))
}

function isFileNotFound(e: unknown) {
    return (e as { code?: string }).code === 'ENOENT'
}
