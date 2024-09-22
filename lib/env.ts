import { copyFile, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { EOL, platform } from 'node:os'
import { join } from 'node:path'
import { vote } from './siblings.js'
import { setupSpelling } from './spelling.js'

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
    ['.gitattributes', '* text=auto eol=lf\n'],
]

export async function prepare() {
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
                .filter(l => !!l && l !== '/template' && l !== '!/eslint.config.js'),
            '/.gitignore',
            '',
        ].join('\n'),
    )
    await writeFile(
        'template/eslint.config.js',
        (await readFile('eslint.config.js', 'utf-8'))
            .split('\n')
            .map(l =>
                l.replace(
                    /import \{ [^}]+ \} from '\.\/lib\/eslint-config.js'/u,
                    `import { configuration } from '@riddance/env/lib/eslint-config.js'`,
                ),
            )
            .join('\n'),
    )
}

export async function setup(targetDir: string) {
    await Promise.all(legacyFiles.map(file => ensureUnlinked(targetDir, file)))
    await Promise.all(dirs.map(dir => mkdir(join(targetDir, dir), { recursive: true })))
    await Promise.all(files.map(file => copyFile(join('template', file), join(targetDir, file))))
    if (!targetDir.endsWith(join('riddance', 'node-env'))) {
        await copyFile('template/gitignore', join(targetDir, '.gitignore'))
        await copyFile('template/eslint.config.js', join(targetDir, 'eslint.config.js'))
    }
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
    await setupSpelling(targetDir)
    await syncGitUser(targetDir)
    await makeWindowsDevcontainerFriendly(targetDir)
    await ensureUnlinked(targetDir, '.timestamps.json')
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

async function makeWindowsDevcontainerFriendly(targetDir: string) {
    if (platform() !== 'win32') {
        return
    }
    const path = join(targetDir, '.git', 'info', 'attributes')
    if (!(await stat(path).catch(isFileNotFound))) {
        return
    }
    await mkdir(join(targetDir, '.git', 'info'), { recursive: true })
    await writeFile(path, sourceExtensions.map(ext => `*${ext} text=auto eol=lf\n`).join(''))
    await forEachSourceFile(targetDir, async p => {
        await writeFile(p, (await readFile(p, 'utf-8')).replaceAll(EOL, '\n'), 'utf-8')
    })
}

const sourceExtensions = ['.ts', '.json', '.txt', '.md']

async function forEachSourceFile(path: string, fn: (p: string) => Promise<void>) {
    const entries = await readdir(path, { withFileTypes: true })
    await Promise.all(
        entries.map(async entry => {
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                await forEachSourceFile(join(path, entry.name), fn)
            }
            if (
                sourceExtensions.some(ext => entry.name.endsWith(ext)) &&
                !entry.name.endsWith('.d.ts')
            ) {
                await fn(join(path, entry.name))
            }
        }),
    )
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
