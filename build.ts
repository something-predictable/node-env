import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getSource, load } from './lib/changes.js'
import { compile } from './lib/compiler.js'
import { Reporter } from './lib/reporter.js'

export async function build(reporter: Reporter, path: string) {
    const changes = await load(path)
    await changes.preCompile(reporter, path)
    const { sourceFiles, outputFiles } = await compile(reporter, path, await findFiles(path))
    return await changes.postCompile(reporter, path, sourceFiles, Promise.resolve(outputFiles))
}

async function findFiles(path: string) {
    const [root, test, bin] = await Promise.all([
        readdir(path),
        readdir(join(path, 'test')),
        readdir(join(path, 'bin')),
    ])
    return getSource(
        [root, test.map(p => join('test', p)), bin.map(p => join('bin', p))].flatMap(d => d),
    )
}
