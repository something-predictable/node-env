// eslint-disable-next-line no-restricted-imports
import fs from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts, { type FileWatcherEventKind } from 'typescript'
import { reportDiagnostic } from '../../lib/compiler.js'
import { isFileNotFound } from '../../lib/fs.js'
import type { Reporter } from '../../lib/reporter.js'

export function watch(
    reporter: Reporter,
    path: string,
    isOutput: (file: string) => boolean,
    filesChanged: (
        success: boolean,
        internalError: boolean,
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
    const nopWatcher = {
        close: () => {
            // Nothing to do
        },
    }
    let latestOutputs: string[] = []
    const watchers: { close: () => void }[] = [
        ...[
            'package.json',
            'package-lock.json',
            'dictionary.txt',
            'test/env.txt',
            'example/package.json',
            'example/package-lock.json',
            'example/test/env.txt',
        ].map(file =>
            watchFile(
                file,
                (name, kind, time) => {
                    reportWatchEvent(reporter, relative(path, name), time, kind)
                    abortController.abort()
                    abortController = new AbortController()
                    filesChanged(true, false, [file], latestOutputs, abortController.signal).catch(
                        (e: unknown) => {
                            if ((e as { code: unknown }).code === 'ABORT_ERR') {
                                return
                            }
                            console.error('Error handling file change:')
                            console.error(e)
                        },
                    )
                },
                500,
            ),
        ),
        ...['test/data', 'example/test/data'].map(p => {
            try {
                return fs.watch(p, { recursive: true }, (kind, name) => {
                    if (!name) {
                        console.error('Null file changed.')
                        return
                    }
                    const file = join(p, name)
                    reportWatchEvent(reporter, file, new Date(), kind)
                    abortController.abort()
                    abortController = new AbortController()
                    filesChanged(true, false, [file], latestOutputs, abortController.signal).catch(
                        (e: unknown) => {
                            if ((e as { code: unknown }).code === 'ABORT_ERR') {
                                return
                            }
                            console.error('Error handling file change:')
                            console.error(e)
                        },
                    )
                })
            } catch (e) {
                if (isFileNotFound(e)) {
                    return nopWatcher
                }
                throw e
            }
        }),
    ]

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
            excludeDirectories: ['.git', '**/test/results'],
            excludeFiles: ['*.js', '*.d.ts', '.timestamps.json'],
        },
    )
    const ignoreFile =
        sep === '/'
            ? (file: string) =>
                  file.includes('/node_modules/') ||
                  file.endsWith('/package.json') ||
                  file.endsWith('test/env.txt')
            : (file: string) =>
                  file.includes('/node_modules/') ||
                  file.includes(`${sep}node_modules${sep}`) ||
                  file.endsWith('/package.json') ||
                  file.endsWith(`${sep}package.json`) ||
                  file.endsWith('test/env.txt') ||
                  file.endsWith(`test${sep}env.txt`)
    const wf = host.watchFile.bind(host)
    host.watchFile = (file, callback, interval, options) => {
        if (ignoreFile(file)) {
            return nopWatcher
        }
        return wf(
            file,
            (name, kind, time) => {
                const rel = relative(path, name)
                if (isOutput(rel)) {
                    return
                }
                reportWatchEvent(reporter, rel, time, kind)
                callback(name, kind, time)
            },
            interval,
            options,
        )
    }
    const ignoreDirectory =
        sep === '/'
            ? (file: string) => file.includes('/node_modules')
            : (file: string) =>
                  file.includes('/node_modules') || file.includes(`${sep}node_modules`)
    const wd = host.watchDirectory.bind(host)
    host.watchDirectory = (directory, callback, recursive, options) => {
        if (ignoreDirectory(directory)) {
            return nopWatcher
        }
        return wd(
            path,
            name => {
                const rel = relative(path, name)
                if (isOutput(rel)) {
                    return
                }
                reporter.status(
                    `💾 ${new Date().toLocaleTimeString()} - ${rel} in ${relative(path, directory)} changed`,
                )
                callback(name)
            },
            recursive,
            options,
        )
    }
    const dir = process.cwd()
    host.afterProgramCreate = programBuilder => {
        const program = programBuilder.getProgram()
        const diagnostics = ts.getPreEmitDiagnostics(program)
        diagnostics.forEach(reportDiagnostic(reporter))
        const emitResult = program.emit()
        emitResult.diagnostics.forEach(reportDiagnostic(reporter))
        if (emitResult.diagnostics.length !== 0 || emitResult.emitSkipped) {
            return
        }
        abortController.abort()
        abortController = new AbortController()
        const outputs = emitResult.emittedFiles?.map(file => relative(dir, file))
        if (outputs) {
            latestOutputs = outputs
        } else {
            console.log('no outputs')
        }
        filesChanged(
            diagnostics.length === 0,
            diagnostics.length !== 0 && diagnostics.every(d => d.code === 6053),
            programBuilder.getSourceFiles().map(sf => relative(dir, sf.fileName)),
            outputs,
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
    const emitResult = watcher.getProgram().emit()
    const outputs = emitResult.emittedFiles?.map(file => relative(dir, file))
    if (outputs) {
        latestOutputs = outputs
    } else {
        console.log('no outputs')
    }
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
    file: string,
    time: Date | undefined,
    kind: FileWatcherEventKind | fs.WatchEventType,
) {
    reporter.status(
        `💾 ${(time ?? new Date()).toLocaleTimeString()} - ${file} ${(() => {
            switch (kind) {
                case ts.FileWatcherEventKind.Created:
                    return 'created'
                case 'change':
                case ts.FileWatcherEventKind.Changed:
                    return 'saved'
                case ts.FileWatcherEventKind.Deleted:
                    return 'deleted'
                case 'rename':
                    return 'renamed'
            }
        })()}`,
    )
}
