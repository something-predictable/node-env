import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import ts from 'typescript'
import { isFileNotFound } from './fs.js'
import { Reporter } from './reporter.js'

export async function writeTSConfig(
    path: string,
    packageDependencies: Promise<{
        dependencies: { [dependency: string]: unknown }
        devDependencies: { [dependency: string]: unknown }
    }>,
) {
    const { dependencies, devDependencies } = await packageDependencies
    const types = [
        ...new Set([
            'node',
            'mocha',
            ...[...Object.keys(dependencies), ...Object.keys(devDependencies)]
                .filter(d => d.startsWith('@types/'))
                .map(d => d.slice('@types/'.length)),
        ]),
    ]
    await patchTypes(resolve(path, 'tsconfig.json'), types)
    await patchTypes(resolve(path, 'example', 'tsconfig.json'), types)
}

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

export function reportDiagnostic(reporter: Reporter) {
    return (diagnostic: ts.Diagnostic) => {
        const { line, character } =
            diagnostic.start === undefined
                ? { line: undefined, character: undefined }
                : (diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start) ?? {})
        reporter.error(
            ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            diagnostic.file?.fileName,
            line ? line + 1 : undefined,
            character ? character + 1 : undefined,
        )
    }
}
async function patchTypes(tsconfigPath: string, types: string[]) {
    try {
        const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf-8')) as {
            compilerOptions?: { types?: string[] }
        }
        if (isDeepStrictEqual(tsconfig.compilerOptions?.types, types)) {
            return
        }
        const compilerOptions = (tsconfig.compilerOptions ??= {})
        compilerOptions.types = types
        await writeFile(tsconfigPath, JSON.stringify(tsconfig, undefined, '  '), 'utf-8')
    } catch (e) {
        if (isFileNotFound(e)) {
            return
        }
        throw e
    }
}
