import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { formatted } from '../lib/formatter.js'
import { lint, makeCache } from '../lib/linter.js'
import { install } from '../lib/npm.js'
import { spelling } from '../lib/spelling.js'
import { test } from '../lib/tester.js'
import { Reporter } from './reporter.js'

export function getSource(input: string[]) {
    return input.filter(
        f => extname(f) === '.ts' && !f.endsWith('.d.ts') && !dirname(f).includes('node_modules'),
    )
}

export async function load(path: string) {
    return new Changes(path, await loadTimestamps(path))
}

export class Changes {
    #path
    #timestamps: Timestamps
    #lintCache

    constructor(path: string, timestamps: Timestamps) {
        this.#path = path
        this.#timestamps = timestamps
        this.#lintCache = makeCache(path)
    }

    async preCompile(reporter: Reporter, path: string) {
        if (await this.shouldInstall()) {
            await install(reporter, path)
            this.#timestamps.stages = {}
        }
    }

    async postCompile(
        reporter: Reporter,
        path: string,
        inputFiles: string[],
        compileResult: Promise<string[] | undefined>,
    ) {
        const source = getSource(inputFiles)
        const result = (
            await Promise.all([
                compileResult,
                this.#ifChanged('formatting', source, reporter, formatted),
                this.#ifChanged('spelling', source, reporter, spelling),
                this.#ifChanged('linting', source, reporter, (r, c) =>
                    lint(r, this.#lintCache, path, c),
                ),
                this.#ifChanged('tests', source, reporter, async (r, changed) => {
                    const outputFiles = await compileResult
                    if (!outputFiles) {
                        return false
                    }
                    const tests = outputFiles.filter(
                        f => dirname(f) === 'test' && !f.endsWith('.d.ts'),
                    )
                    return await test(r, path, tests, changed)
                }),
            ])
        ).every(r => r)
        await this.#setOutputs(await compileResult)
        await this.#saveTimestamps()
        return result
    }

    async shouldInstall() {
        const oldestStage =
            Object.values(this.#timestamps.stages)
                .map(d => new Date(d).getTime())
                .sort()
                .at(0) ?? -1
        const latestPackage =
            (
                await Promise.all(
                    ['package.json', 'package-lock.json'].map(f => stat(resolve(this.#path, f))),
                )
            )
                .map(s => s.ctimeMs)
                .sort()
                .at(-1) ?? 0
        return oldestStage < latestPackage
    }

    async stageComplete(stage: string) {
        this.#timestamps.stages[stage] = new Date().toISOString()
        await this.#saveTimestamps()
    }
    async clearStages() {
        this.#timestamps.stages = {}
        this.#lintCache = makeCache(this.#path)
        await this.#saveTimestamps()
    }

    async #ifChanged(
        stage: string,
        source: string[],
        reporter: Reporter,
        fn: (r: Reporter, src: string[]) => Promise<boolean>,
    ) {
        const { stages } = this.#timestamps
        if (stages[stage]) {
            const lastSuccess = new Date(this.#timestamps.stages[stage] ?? 0).getTime()
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
        if (await fn(reporter, source)) {
            stages[stage] = new Date().toISOString()
            return true
        }
        return false
    }

    async #setOutputs(outputs: string[] | undefined) {
        for (const old of this.#timestamps.outputs) {
            if (!outputs?.includes(old)) {
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
        this.#timestamps.outputs = outputs ?? []
    }

    async #saveTimestamps() {
        await writeFile(
            join(this.#path, '.timestamps.json'),
            JSON.stringify(this.#timestamps, undefined, '  '),
        )
    }
}

interface Timestamps {
    outputs: string[]
    stages: { [stage: string]: string }
}

async function loadTimestamps(path: string) {
    try {
        return JSON.parse(await readFile(join(path, '.timestamps.json'), 'utf-8')) as Timestamps
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

function isFileNotFound(e: unknown) {
    return (e as { code?: string }).code === 'ENOENT'
}
