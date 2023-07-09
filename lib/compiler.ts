import { relative, resolve } from 'node:path'
import ts from 'typescript'
import { Reporter } from './reporter.js'

export function compile(reporter: Reporter, path: string) {
    const configFile = ts.readConfigFile(resolve(path, 'tsconfig.json'), p => ts.sys.readFile(p))
    if (configFile.error) {
        reportDiagnostic(reporter)(configFile.error)
        return { sourceFiles: [] }
    }

    const tsconfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './')
    if (tsconfig.errors.length !== 0) {
        tsconfig.errors.forEach(reportDiagnostic(reporter))
        return { sourceFiles: [] }
    }

    const program = ts.createProgram(tsconfig.fileNames, {
        ...tsconfig.options,
        listEmittedFiles: true,
        outDir: path,
        rootDir: path,
        typeRoots: [resolve(path, 'node_modules/@types')],
    })
    const sourceFiles = program.getSourceFiles().map(sf => relative(path, sf.fileName))

    const diagnostics = ts.getPreEmitDiagnostics(program)
    diagnostics.forEach(reportDiagnostic(reporter))
    const emitResult = program.emit()
    emitResult.diagnostics.forEach(reportDiagnostic(reporter))
    if (diagnostics.length !== 0 || emitResult.diagnostics.length !== 0 || emitResult.emitSkipped) {
        return { sourceFiles }
    }
    return {
        sourceFiles,
        outputFiles: emitResult.emittedFiles?.map(f => relative(path, f)),
    }
}

function reportDiagnostic(reporter: Reporter) {
    return (diagnostic: ts.Diagnostic) => {
        const { line, character } =
            (diagnostic.start &&
                diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start)) ||
            {}
        reporter.error(
            ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            diagnostic.file?.fileName,
            line,
            character,
        )
    }
}
