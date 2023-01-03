import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { EOL } from 'node:os'
import { join } from 'node:path'

const dirs = ['.vscode', '.idea/codeStyles/', '.idea/inspectionProfiles/']
const files = [
    '.eslintrc.json',
    '.prettierrc',
    'tsconfig.json',
    '.vscode/settings.json',
    '.vscode/extensions.json',
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
            .split(EOL)
            .filter(l => !!l && l !== 'template/')
            .concat(...files, '.gitignore', '')
            .join(EOL),
    )
}

export async function setup(targetDir: string) {
    await Promise.all(dirs.map(dir => mkdir(join(targetDir, dir), { recursive: true })))
    await Promise.all(files.map(file => copyFile(join('template', file), join(targetDir, file))))
    await copyFile('template/gitignore', join(targetDir, '.gitignore'))
}
