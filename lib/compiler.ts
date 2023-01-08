import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import ts from 'typescript'
import { Reporter } from './reporter.js'

export async function compile(reporter: Reporter, path: string) {
    const tsconfig = JSON.parse(
        (await readFile(resolve(path, 'tsconfig.json'))).toString('utf-8'),
    ) as {
        compilerOptions: unknown
        include: string[]
        exclude: string[]
    }
    const options = ts.convertCompilerOptionsFromJson(tsconfig.compilerOptions, path)
    if (options.errors.length !== 0) {
        options.errors.forEach(reportDiagnostic(reporter))
        return { sourceFiles: [] }
    }
    const inputFiles = ts.sys
        .readDirectory(path, undefined, tsconfig.exclude, tsconfig.include)
        .filter(f => !f.endsWith('.d.ts'))

    const program = ts.createProgram(
        inputFiles.map(f => resolve(path, f)),
        {
            ...options.options,
            listEmittedFiles: true,
            outDir: path,
            rootDir: path,
            typeRoots: [resolve(path, 'node_modules/@types')],
        },
    )
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
