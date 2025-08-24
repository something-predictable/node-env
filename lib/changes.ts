import { spawn } from 'node:child_process'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { formatted } from '../lib/formatter.js'
import { lint, makeCache } from '../lib/linter.js'
import { install } from '../lib/npm.js'
import { spelling } from '../lib/spelling.js'
import { isTest, test, writeTestConfig } from '../lib/tester.js'
import { setupAgents } from './agents.js'
import { dependantPackages } from './dependencies.js'
import { Reporter } from './reporter.js'

export function getSource(input: string[]) {
    return input.filter(
        f => extname(f) === '.ts' && !f.endsWith('.d.ts') && !dirname(f).includes('node_modules'),
    )
}

export async function load(path: string) {
    return new Changes(path, await loadMyVersion(path), await loadTimestamps(path))
}

export class Changes {
    readonly #path
    readonly #myVersion: string | undefined
    readonly #timestamps: Timestamps
    #lintCache

    constructor(path: string, myVersion: string | undefined, timestamps: Timestamps) {
        this.#path = path
        this.#myVersion = myVersion
        this.#timestamps = timestamps
        this.#lintCache = makeCache(path)
    }

    async preCompile(reporter: Reporter, path: string) {
        if (await this.shouldInstall()) {
            if (!(await install(reporter, path))) {
                await this.clearStages()
                return false
            }
            this.#timestamps.stages = {}
            const dependencies = dependantPackages(path)
            await this.stageComplete('install')
            await this.#restartIfUpdated(reporter)
            await setupAgents(path, dependencies)
            await writeTestConfig(path, dependencies)
        }
        return (
            (await checkNodeVersion(reporter, path, 'package.json')) &&
            (await checkNodeVersion(reporter, path, 'example/package.json'))
        )
    }

    async postCompile(
        reporter: Reporter,
        path: string,
        inputFiles: string[],
        compileResult: Promise<string[] | undefined>,
        abort: AbortSignal,
    ) {
        const source = getSource(inputFiles)
        const result = (
            await Promise.all([
                compileResult,
                this.#ifChanged('formatting', source, s => formatted(reporter, path, s, abort)),
                this.#ifChanged('spelling', source, s => spelling(reporter, path, s, abort)),
                this.#ifChanged('linting', source, s => lint(reporter, path, s, this.#lintCache)),
                this.#ifChanged('tests', source, async s => {
                    const outputFiles = await compileResult
                    if (abort.aborted) {
                        return false
                    }
                    if (!outputFiles) {
                        return false
                    }
                    const tests = outputFiles.filter(f => isTest(f) && !f.endsWith('.d.ts'))
                    return await test(reporter, path, tests, s, abort)
                }),
            ])
        ).every(r => !!r)
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
                    [
                        'package.json',
                        'package-lock.json',
                        'example/package.json',
                        'example/package-lock.json',
                    ].map(async f => {
                        try {
                            return await stat(resolve(this.#path, f))
                        } catch (e) {
                            if (isFileNotFound(e)) {
                                return { ctimeMs: 0 }
                            }
                            throw e
                        }
                    }),
                )
            )
                .map(s => s.ctimeMs)
                .sort()
                .at(-1) ?? 0
        return oldestStage < latestPackage
    }

    async #restartIfUpdated(reporter: Reporter) {
        if (this.#myVersion === (await loadMyVersion(this.#path))) {
            return
        }
        reporter.status('Restarting...')
        const [cmd, ...argv] = process.argv
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const proc = spawn(cmd!, argv, {
            stdio: [process.stdin, process.stdout, process.stderr, 'pipe'],
        })
        // eslint-disable-next-line promise/param-names
        return new Promise(exit => {
            proc.addListener('exit', exit)
        })
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

    async #ifChanged(stage: string, source: string[], fn: (src: string[]) => Promise<boolean>) {
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
        if (await fn(source)) {
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

type Timestamps = {
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

async function loadMyVersion(path: string, reporter?: Reporter) {
    try {
        const { dependencies = {}, devDependencies = {} } = JSON.parse(
            await readFile(join(path, 'package.json'), 'utf-8'),
        ) as {
            dependencies?: { [p: string]: string }
            devDependencies?: { [p: string]: string }
        }
        const myVersion = devDependencies['@riddance/env']
        if (!myVersion) {
            if (dependencies['@riddance/env']) {
                reporter?.error(
                    '@riddance/env should be added to package.json as a devDependency, not a dependency.',
                )
            }
            return
        }
        return myVersion
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
}

async function checkNodeVersion(
    reporter: Reporter | undefined,
    path: string,
    packageJsonPath: string,
) {
    try {
        const { engines } = JSON.parse(await readFile(join(path, packageJsonPath), 'utf-8')) as {
            engines?: { node?: string }
        }
        if (!engines?.node) {
            reporter?.error('Please specify node engine in package.json.')
            return false
        }
        const [exeMajor] = process.version.slice(1).split('.')
        if (!exeMajor) {
            throw new Error('Unexpected node version: ' + process.version)
        }
        if (!engineCompatible(engines.node, exeMajor)) {
            reporter?.error(
                `Running different version of node than specified in package.json. Consider adding "node": ">=${exeMajor} to the engines property.`,
            )
            return false
        }
        const myNodeVersion = '22'
        if (!engineCompatible(engines.node, myNodeVersion)) {
            reporter?.error(
                `Your version of @riddance/env expects to be running on node version ${myNodeVersion}. Consider adding "node": ">=${myNodeVersion} to the engines property.`,
            )
            return false
        }
        return true
    } catch (e) {
        if (isFileNotFound(e)) {
            return true
        }
        throw e
    }
}

function engineCompatible(engineVersion: string, version: string) {
    return (
        engineVersion === version ||
        engineVersion === `>=${version}` ||
        engineVersion.startsWith(`${version}.`) ||
        engineVersion.startsWith(`>=${version}.`)
    )
}

function isFileNotFound(e: unknown) {
    return (e as { code: unknown }).code === 'ENOENT'
}
