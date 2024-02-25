import { load } from './lib/changes.js'
import { sync } from './lib/chrono.js'
import { compile } from './lib/compiler.js'
import { Reporter } from './lib/reporter.js'

export async function build(reporter: Reporter, path: string) {
    const changes = await load(path)
    await Promise.all([changes.preCompile(reporter, path), sync()])
    const { sourceFiles, outputFiles } = compile(reporter, path)
    return await changes.postCompile(
        reporter,
        path,
        sourceFiles,
        Promise.resolve(outputFiles),
        new AbortSignal(),
    )
}
