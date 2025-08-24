import { relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dependantPackages } from './dependencies.js'
import { writeTestConfig } from './tester.js'

const cwd = process.cwd()
const baseUrl = `${pathToFileURL(cwd).href}/`
await writeTestConfig(
    cwd,
    dependantPackages(cwd),
    hook =>
        `./${relative(cwd, fileURLToPath(import.meta.resolve(hook, baseUrl))).replaceAll(
            sep,
            '/',
        )}`,
)
