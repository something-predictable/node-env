import { load } from './lib/changes.js'
import { sync } from './lib/chrono.js'
import { compile } from './lib/compiler.js'
import { Reporter } from './lib/reporter.js'

export async function build(reporter: Reporter, path: string) {
    const abort = new AbortController()
    const changes = await load(path)
    const [preCompileSuccess] = await Promise.all([changes.preCompile(reporter, path), sync()])
    if (!preCompileSuccess) {
        return false
    }
    const { sourceFiles, outputFiles } = compile(reporter, path)
    return await changes.postCompile(
        reporter,
        path,
        sourceFiles,
        Promise.resolve(outputFiles),
        abort.signal,
    )
}
