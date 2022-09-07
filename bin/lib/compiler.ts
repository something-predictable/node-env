import { relative } from 'node:path'
import ts from 'typescript'

export function watch(
    filesChanged: (success: boolean, inputFiles: string[], outputFiles: string[]) => Promise<void>,
): { close: () => void } {
    const watchFile = ts.sys.watchFile?.bind(ts.sys)
    if (!watchFile) {
        throw new Error('watchFile missing from typescript sys')
    }
    const watchers = ['package.json', 'package-lock.json', 'dictionary.txt'].map(file =>
        watchFile(file, () => {
            filesChanged(true, [file], []).catch(e => {
                console.error('Error handling file changes:')
                console.error(e)
            })
        }),
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
            excludeFiles: ['package.json'],
        },
    )
    host.afterProgramCreate = programBuilder => {
        const program = programBuilder.getProgram()
        const diagnostics = ts.getPreEmitDiagnostics(program)
        diagnostics.forEach(dumpDiagnostic)
        const emitResult = program.emit()
        emitResult.diagnostics.forEach(dumpDiagnostic)
        if (emitResult.diagnostics.length !== 0 || emitResult.emitSkipped) {
            return
        }
        const dir = process.cwd()
        filesChanged(
            diagnostics.length === 0,
            programBuilder.getSourceFiles().map(sf => relative(dir, sf.fileName)),
            emitResult.emittedFiles?.map(file => relative(dir, file)) ?? [],
        ).catch(e => {
            console.error('Error handling file changes:')
            console.error(e)
            console.error((e as Error).stack)
        })
    }
    const watcher = ts.createWatchProgram(host)
    return {
        close: () => {
            watchers.forEach(w => w.close())
            watcher.close()
        },
    }
}

function dumpDiagnostic(diagnostic: ts.Diagnostic) {
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (diagnostic.file) {
        if (diagnostic.start) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
                diagnostic.start,
            )
            message = `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
        } else {
            message = `${diagnostic.file.fileName}: ${message}`
        }
    }
    console.log(message)
}
