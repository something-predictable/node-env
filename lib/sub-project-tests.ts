import { relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeTestConfig } from './tester.js'

const cwd = process.cwd()
const baseUrl = `${pathToFileURL(cwd).href}/`
await writeTestConfig(
    cwd,
    hook =>
        `./${relative(cwd, fileURLToPath(import.meta.resolve(hook, baseUrl))).replaceAll(
            sep,
            '/',
        )}`,
)
