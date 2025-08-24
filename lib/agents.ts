import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { EOL } from 'node:os'
import { join } from 'node:path'

type Dependencies = {
    [dependency: string]: {
        path: string
        packageJson: unknown
    }
}

export async function setupAgents(
    path: string,
    dependencies: Promise<{
        dependencies: Dependencies
        devDependencies: Dependencies
    }>,
    myself?: boolean,
) {
    const [readme, instructions, dependencyInstructions] = await Promise.all([
        readReadme(path),
        readInstructions(path),
        getInstructions(dependencies),
    ])
    const sections = [
        ...makeSingleFileSections(readme, instructions, dependencyInstructions, myself),
    ]
    const rules = [...makeRules(readme, instructions, dependencyInstructions, myself)]
    await Promise.all([
        writeClaudeCode(path, sections, myself),
        writeCopilot(path, sections),
        writeCursor(path, rules),
        writeContinue(path, rules),
        writeCodexAndOpenCode(path, sections),
    ])
}

async function writeClaudeCode(path: string, sections: string[], myself?: boolean) {
    const filePath = join(path, 'CLAUDE.md')
    if (sections.length === 0) {
        await unlink(filePath)
    }
    await writeFile(
        filePath,
        [
            `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
`,
            ...sections,
        ].join(EOL),
    )
    await mkdir(join(path, '.claude'), { recursive: true })
    await writeFile(
        join(path, '.claude/settings.local.json'),
        JSON.stringify(
            {
                permissions: {
                    defaultMode: 'acceptEdits',
                    allow: myself
                        ? ['Bash(node ./bin/fix.js)', 'Bash(node ./bin/build.js)']
                        : [
                              'Bash(npm init)',
                              'Bash(mkdir -p test)',
                              'Bash(./node_modules/.bin/riddance-fix)',
                              'Bash(./node_modules/.bin/riddance-build)',
                          ],
                },
            },
            undefined,
            '  ',
        ),
        'utf-8',
    )
}

async function writeCopilot(path: string, sections: string[]) {
    const filePath = join(path, '.github', 'copilot-instructions.md')
    if (sections.length === 0) {
        await unlink(filePath)
    }
    await mkdir(join(path, '.github'), { recursive: true })
    await writeFile(
        filePath,
        [
            `# Guide for Copilot
`,
            ...sections,
        ].join(EOL),
    )
}

async function writeCursor(path: string, rules: Rule[]) {
    await syncRules(path, '.cursor', rules)
}

async function writeContinue(path: string, rules: Rule[]) {
    await syncRules(path, '.continue', rules)
}

async function writeCodexAndOpenCode(path: string, sections: string[]) {
    const filePath = join(path, 'AGENTS.md')
    if (sections.length === 0) {
        await unlink(filePath)
    }
    await writeFile(filePath, sections.join(EOL))
}

async function syncRules(path: string, directory: string, rules: Rule[]) {
    const directoryPath = join(path, directory, 'rules')
    const files = rules.map(
        r =>
            [
                r.name.replaceAll(/[^a-zA-Z0-9]/gu, '-'),
                `---
description: ${r.description}
globs: **/*.ts
---

${r.body}`,
            ] as const,
    )

    await mkdir(directoryPath, { recursive: true })
    const existingFiles = await readdir(directoryPath)

    for (const existingFile of existingFiles) {
        if (!files.some(([name]) => name === existingFile)) {
            await unlink(join(directoryPath, existingFile))
        }
    }

    for (const [fileName, content] of files) {
        const filePath = join(directoryPath, fileName)
        if (existingFiles.includes(fileName)) {
            const existingContent = await readFile(filePath, 'utf-8')
            if (existingContent !== content) {
                await writeFile(filePath, content, 'utf-8')
            }
        } else {
            await writeFile(filePath, content, 'utf-8')
        }
    }
}

type Rule = {
    name: string
    description: string
    body: string
}

function* makeRules(
    readme: string | undefined,
    instructions: string | undefined,
    dependencyInstructions: (readonly [string, string])[],
    myself?: boolean,
): Generator<Rule> {
    if (myself) {
        if (instructions) {
            yield {
                name: 'package-users',
                description: '',
                body: instructions,
            }
        }
        return
    }
    for (const [dependency, instruction] of dependencyInstructions) {
        yield {
            name: 'usage',
            description: `The project uses the ${dependency} package, which means you need to follow these instructions`,
            body: instruction,
        }
    }
    if (readme) {
        yield {
            name: 'readme',
            description: 'The following is an overview of this project.',
            body: readme,
        }
    }
}

function* makeSingleFileSections(
    readme: string | undefined,
    instructions: string | undefined,
    dependencyInstructions: (readonly [string, string])[],
    myself?: boolean,
) {
    if (myself) {
        if (instructions) {
            yield `
This is a TypeScript package meant to be installed by other Node packages.

We aim to allow the users of this package to follow the following instructions. Note that any commands we provide, the users of this package will invoke through node_modules. We can also invoke those commands, but they will need to be executed using the node command and then the corresponding file in the bin directory.
`
            yield instructions
        }
        return
    }
    if (dependencyInstructions.length !== 0) {
        yield `# Packages

This project uses one or more packages that impact the way code is written. Details are as follows.
`
    }
    for (const [dependency, instruction] of dependencyInstructions) {
        yield `The project uses the ${dependency} package, which means you need to follow these instructions:
`
        yield subsection(instruction)
    }
    if (readme) {
        yield `# Overview

The following is an overview of this project.
`
        yield subsection(readme)
    }
}

async function readReadme(path: string) {
    try {
        return await readFile(join(path, 'README.md'), 'utf-8')
    } catch (e) {
        if (isFileNotFound(e)) {
            return undefined
        }
        throw e
    }
}

async function readInstructions(path: string) {
    try {
        return await readFile(join(path, 'instructions.md'), 'utf-8')
    } catch (e) {
        if (isFileNotFound(e)) {
            return undefined
        }
        throw e
    }
}

function subsection(section: string) {
    return section.replaceAll(/^(#+)/gmu, '#$1')
}

async function getInstructions(
    dependencies: Promise<{
        dependencies: Dependencies
        devDependencies: Dependencies
    }>,
) {
    const deps = await dependencies
    return (
        await Promise.all(
            Object.entries({ ...deps.dependencies, ...deps.devDependencies }).map(
                async ([dependency, { path, packageJson }]) => {
                    const { ai } = packageJson as { ai?: { instructions: string } }
                    if (typeof ai?.instructions !== 'string') {
                        return undefined
                    }
                    try {
                        return [
                            dependency,
                            await readFile(join(path, ai.instructions), 'utf-8'),
                        ] as const
                    } catch (e) {
                        if (isFileNotFound(e)) {
                            return undefined
                        }
                        throw e
                    }
                },
            ),
        )
    ).filter(h => h !== undefined)
}

function isFileNotFound(e: unknown) {
    return (e as { code: unknown }).code === 'ENOENT'
}
