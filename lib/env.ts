import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { EOL } from 'node:os'
import { join } from 'node:path'

const dirs = ['.vscode', '.devcontainer', '.idea/codeStyles/', '.idea/inspectionProfiles/']
const files = [
    '.eslintrc.json',
    '.prettierrc',
    'tsconfig.json',
    '.vscode/settings.json',
    '.vscode/extensions.json',
    '.devcontainer/Dockerfile',
    '.devcontainer/devcontainer.json',
    '.idea/compiler.xml',
    '.idea/codeStyles/codeStyleConfig.xml',
    '.idea/inspectionProfiles/Project_Default.xml',
]

export async function prepare() {
    await rm('template', { recursive: true, force: true })
    await mkdir('template')
    await Promise.all(dirs.map(dir => mkdir(join('template', dir), { recursive: true })))
    await Promise.all(files.map(file => copyFile(file, join('template', file))))
    await writeFile(
        'template/gitignore',
        (
            await readFile('.gitignore', 'utf-8')
        )
            .split('\n')
            .filter(l => !!l && l !== 'template/')
            .concat(...files, '.gitignore', '')
            .join('\n'),
    )
}

export async function setup(targetDir: string) {
    await Promise.all(dirs.map(dir => mkdir(join(targetDir, dir), { recursive: true })))
    await Promise.all(files.map(file => copyFile(join('template', file), join(targetDir, file))))
    await copyFile('template/gitignore', join(targetDir, '.gitignore'))
    await makeWindowsDevcontainerFriendly(targetDir)
}

async function makeWindowsDevcontainerFriendly(targetDir: string) {
    if (await stat(join(targetDir, '.gitattributes')).catch(e => !e)) {
        return
    }

    await writeFile(join(targetDir, '.gitattributes'), '* text=auto eol=lf\n')
    await forEachSourceFile(targetDir, async path => {
        await writeFile(path, (await readFile(path, 'utf-8')).replaceAll(EOL, '\n'), 'utf-8')
    })
}

async function forEachSourceFile(path: string, fn: (p: string) => Promise<void>) {
    const entries = await readdir(path, { withFileTypes: true })
    await Promise.all(
        entries.map(async entry => {
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                await forEachSourceFile(join(path, entry.name), fn)
            }
            if (
                (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) ||
                entry.name.endsWith('.json')
            ) {
                await fn(join(path, entry.name))
            }
        }),
    )
}
