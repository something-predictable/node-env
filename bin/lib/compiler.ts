import { relative } from 'node:path'
import ts from 'typescript'
import { reportDiagnostic } from '../../lib/compiler.js'
import type { Reporter } from '../../lib/reporter.js'

export function watch(
    reporter: Reporter,
    filesChanged: (
        success: boolean,
        inputFiles: string[],
        outputFiles: string[] | undefined,
        signal: AbortSignal,
    ) => Promise<void>,
): { close: () => void } {
    let abortController = new AbortController()
    const watchFile = ts.sys.watchFile?.bind(ts.sys)
    if (!watchFile) {
        throw new Error('watchFile missing from typescript sys')
    }
    const watchers = [
        'package.json',
        'package-lock.json',
        'dictionary.txt',
        'example/package.json',
        'example/package-lock.json',
    ].map(file =>
        watchFile(
            file,
            () => {
                abortController.abort()
                abortController = new AbortController()
                filesChanged(true, [file], [], abortController.signal).catch((e: unknown) => {
                    if ((e as { code: unknown }).code === 'ABORT_ERR') {
                        return
                    }
                    console.error('Error handling file changes:')
                    console.error(e)
                })
            },
            500,
        ),
    )
    const host = ts.createWatchCompilerHost(
        'tsconfig.json',
        {
            listEmittedFiles: true,
        },
        ts.sys,
        undefined,
        undefined,
        undefined,
        {
            excludeFiles: ['package.json', 'example/package.json'],
        },
    )
    host.afterProgramCreate = programBuilder => {
        const program = programBuilder.getProgram()
        const diagnostics = ts.getPreEmitDiagnostics(program)
        diagnostics.forEach(reportDiagnostic(reporter))
        const emitResult = program.emit()
        emitResult.diagnostics.forEach(reportDiagnostic(reporter))
        if (emitResult.diagnostics.length !== 0 || emitResult.emitSkipped) {
            return
        }
        const dir = process.cwd()
        abortController.abort()
        abortController = new AbortController()
        filesChanged(
            diagnostics.length === 0,
            programBuilder.getSourceFiles().map(sf => relative(dir, sf.fileName)),
            emitResult.emittedFiles?.map(file => relative(dir, file)),
            abortController.signal,
        ).catch((e: unknown) => {
            if ((e as { code: unknown }).code === 'ABORT_ERR') {
                return
            }
            console.error('Error handling file changes:')
            console.error(e)
        })
    }
    const watcher = ts.createWatchProgram(host)
    return {
        close: () => {
            watchers.forEach(w => {
                w.close()
            })
            watcher.close()
            abortController.abort()
        },
    }
}
