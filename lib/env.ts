// eslint-disable-next-line no-restricted-imports
import type { Dirent } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { EOL, platform } from 'node:os'
import { join } from 'node:path'
import { setupAgents } from './agents.js'
import { dependantPackages } from './dependencies.js'
import { vote } from './siblings.js'
import { setupSpelling } from './spelling.js'
import { writeTestConfig } from './tester.js'

const dirs = ['.vscode', '.devcontainer', '.idea/codeStyles/', '.idea/inspectionProfiles/']
const files = [
    'tsconfig.json',
    '.prettierrc.json',
    '.editorconfig',
    '.vscode/settings.json',
    '.vscode/tasks.json',
    '.vscode/extensions.json',
    '.devcontainer/Dockerfile',
    '.devcontainer/devcontainer.json',
    '.idea/compiler.xml',
    '.idea/codeStyles/codeStyleConfig.xml',
    '.idea/inspectionProfiles/Project_Default.xml',
]
const overridableFiles: [string, (content: string) => boolean][] = []
const legacyFiles: (string | [string, string])[] = [
    '.prettierrc',
    'Dockerfile.integration',
    '.eslintrc.json',
    'eslint.config.js',
    ['.gitattributes', '* text=auto eol=lf\n'],
]

export async function prepare() {
    await createTemplate()
    await makeWindowsNpmPackFriendly('template')
}

async function createTemplate() {
    await rm('template', { recursive: true, force: true })
    await mkdir('template')
    await Promise.all(dirs.map(dir => mkdir(join('template', dir), { recursive: true })))
    await Promise.all(
        [...files, ...overridableFiles.map(f => f[0])].map(file =>
            copyFile(file, join('template', file)),
        ),
    )
    await writeFile(
        'template/gitignore',
        [
            ...files.map(f => `/${f}`),
            ...(await readFile('.gitignore', 'utf-8'))
                .split('\n')
                .filter(l => !!l && l.trim() !== '/template' && l.trim() !== '!/eslint.config.mjs'),
            '/eslint.config.mjs',
            '/.gitignore',
            '',
        ].join('\n'),
    )
    await writeFile(
        'template/eslint.config.mjs',
        (await readFile('eslint.config.mjs', 'utf-8'))
            .split('\n')
            .map(l =>
                l
                    .replace(
                        /import \{ [^}]+ \} from '\.\/lib\/eslint-config.js'/u,
                        `import { configuration } from '@riddance/env/lib/eslint-config.js'`,
                    )
                    .trim(),
            )
            .join('\n'),
    )
}

export async function setup(targetDir: string, myself: boolean) {
    await Promise.all(legacyFiles.map(file => ensureUnlinked(targetDir, file)))
    await Promise.all(dirs.map(dir => mkdir(join(targetDir, dir), { recursive: true })))
    const dependencies = dependantPackages(targetDir)
    await Promise.all([
        ...(myself ? [] : [copyFromTemplate(targetDir)]),
        setupSpelling(targetDir),
        writeTestConfig(targetDir, dependencies),
        syncGitUser(targetDir),
        setupAgents(targetDir, dependencies, myself),
        makeWindowsNpmPackAndDevcontainerFriendly(targetDir),
        ensureUnlinked(targetDir, '.timestamps.json'),
    ])
}

async function copyFromTemplate(targetDir: string) {
    await Promise.all(files.map(file => copyFile(join('template', file), join(targetDir, file))))
    await copyFile('template/gitignore', join(targetDir, '.gitignore'))
    await copyFile('template/eslint.config.mjs', join(targetDir, 'eslint.config.mjs'))
    for (const [file, belongsHere] of overridableFiles) {
        try {
            const existing = await readFile(join(targetDir, file), 'utf-8')
            if (!belongsHere(existing)) {
                continue
            }
        } catch (e) {
            if (!isFileNotFound(e)) {
                throw e
            }
        }
        await copyFile(join('template', file), join(targetDir, file))
    }
}

async function syncGitUser(path: string) {
    try {
        const [ws, core, ...sections] = (await readFile(join(path, '.git/config'), 'utf-8')).split(
            '[',
        )
        if (!ws || !core || sections[0]?.startsWith('user]')) {
            return
        }
        const user = await vote(path, '.git/config', content =>
            content
                .split('[')
                .filter(section => section.startsWith('user]'))
                .join('['),
        )
        if (!user) {
            return
        }
        await writeFile(join(path, '.git/config'), [ws, core, user, ...sections].join('['), 'utf-8')
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
}

async function makeWindowsNpmPackAndDevcontainerFriendly(targetDir: string) {
    if (platform() !== 'win32') {
        return
    }
    const path = join(targetDir, '.git', 'info', 'attributes')
    if (!(await stat(path).catch(isFileNotFound))) {
        return
    }
    await mkdir(join(targetDir, '.git', 'info'), { recursive: true })
    await writeFile(path, sourceExtensions.map(ext => `*${ext} text=auto eol=lf\n`).join(''))
    for await (const sourceFile of findFiles(targetDir, isSource)) {
        await dos2unix(sourceFile)
    }
}

async function makeWindowsNpmPackFriendly(targetDir: string) {
    if (platform() !== 'win32') {
        return
    }
    for await (const sourceFile of findFiles(targetDir, () => true)) {
        await dos2unix(sourceFile)
    }
}

async function dos2unix(file: string) {
    const dos = await readFile(file, 'utf-8')
    const unix = dos.replaceAll(EOL, '\n')
    if (unix.length !== dos.length) {
        await writeFile(file, unix, 'utf-8')
    }
}

const sourceExtensions = ['.ts', '.json', '.txt', '.md']
const otherSources = new Set(['LICENSE', 'eslint.config.mjs'])

function isSource(file: Dirent) {
    return (
        (sourceExtensions.some(ext => file.name.endsWith(ext)) && !file.name.endsWith('.d.ts')) ||
        otherSources.has(file.name)
    )
}

async function* findFiles(
    path: string,
    predicate: (entry: Dirent) => boolean,
): AsyncGenerator<string, void> {
    const entries = await readdir(path, { withFileTypes: true })
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            yield* findFiles(join(path, entry.name), predicate)
        }
        if (entry.isFile() && predicate(entry)) {
            yield join(path, entry.name)
        }
    }
}

async function ensureUnlinked(dir: string, file: string | [string, string]) {
    try {
        if (Array.isArray(file)) {
            const [filename, expectedContents] = file
            const path = join(dir, filename)
            if ((await readFile(path, 'utf-8')) !== expectedContents) {
                return
            }
            await unlink(join(dir, filename))
        } else {
            await unlink(join(dir, file))
        }
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
}

function isFileNotFound(e: unknown) {
    return (e as { code?: string }).code === 'ENOENT'
}
