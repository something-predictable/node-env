import { relative } from 'node:path'
import ts, { type FileWatcherEventKind } from 'typescript'
import { reportDiagnostic } from '../../lib/compiler.js'
import type { Reporter } from '../../lib/reporter.js'

export function watch(
    reporter: Reporter,
    path: string,
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
            (name, kind, time) => {
                reportWatchEvent(reporter, path, name, time, kind)
                abortController.abort()
                abortController = new AbortController()
                filesChanged(true, [file], [], abortController.signal).catch((e: unknown) => {
                    if ((e as { code: unknown }).code === 'ABORT_ERR') {
                        return
                    }
                    console.error('Error handling file change:')
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
        d => {
            reporter.status(
                typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText,
            )
        },
        {
            excludeDirectories: ['.git', 'node_modules', '**/test/results'],
            excludeFiles: [
                '*.js',
                '*.d.ts',
                '.timestamps.json',
                'package.json',
                'example/package.json',
            ],
        },
    )
    const wf = host.watchFile.bind(host)
    host.watchFile = (file, callback, interval, options) => {
        return wf(
            file,
            (name, kind, time) => {
                reportWatchEvent(reporter, path, name, time, kind)
                callback(name, kind, time)
            },
            interval,
            options,
        )
    }
    const wd = host.watchDirectory.bind(host)
    host.watchDirectory = (directory, callback, recursive, options) =>
        wd(
            path,
            name => {
                reporter.status(
                    `💾 ${new Date().toLocaleTimeString()} - ${relative(path, name)} in ${relative(path, directory)} changed`,
                )
                callback(name)
            },
            recursive,
            options,
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

function reportWatchEvent(
    reporter: Reporter,
    path: string,
    file: string,
    time: Date | undefined,
    kind: FileWatcherEventKind,
) {
    reporter.status(
        `💾 ${(time ?? new Date()).toLocaleTimeString()} - ${relative(path, file)} ${(() => {
            switch (kind) {
                case ts.FileWatcherEventKind.Created:
                    return 'created'
                case ts.FileWatcherEventKind.Changed:
                    return 'changed'
                case ts.FileWatcherEventKind.Deleted:
                    return 'deleted'
            }
        })()}`,
    )
}
