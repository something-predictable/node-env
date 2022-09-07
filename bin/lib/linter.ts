import { ESLint } from 'eslint'

let eslint = new ESLint()
let formatter = await eslint.loadFormatter('stylish')

export async function lint(files: string[]) {
    const results = await eslint.lintFiles(files)
    const resultText = formatter.format(results)
    if (resultText) {
        console.log(resultText)
    }
    return !results.some(r => r.fatalErrorCount + r.errorCount)
}

export async function clearCache() {
    eslint = new ESLint()
    formatter = await eslint.loadFormatter('stylish')
}
