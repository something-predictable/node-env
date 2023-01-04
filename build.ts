import { load } from './lib/changes.js'
import { compile } from './lib/compiler.js'
import { Reporter } from './lib/reporter.js'

export async function build(reporter: Reporter, path: string) {
    const changes = await load(path)
    await changes.preCompile(reporter, path)
    const { sourceFiles, outputFiles } = await compile(reporter, path)
    return await changes.postCompile(reporter, path, sourceFiles, Promise.resolve(outputFiles))
}
