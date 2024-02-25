import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const cwd = process.cwd()

export const consoleReporter = {
    status: (message: string) => console.log(message),
    error: (message: string, file?: string, line?: number, column?: number) => {
        let context = ''
        if (file) {
            if (file.startsWith('file://')) {
                context += relative(cwd, fileURLToPath(file))
            } else {
                context += relative(cwd, file)
            }
            if (line) {
                context += ':' + line.toString()
                if (column) {
                    context += ':' + column.toString()
                }
            }
            context += ' - '
        }
        console.error(context + message)
    },
    fatal: (message: string, error: unknown, file?: string) => {
        let context = ''
        if (file) {
            context += file + ' - '
        }
        console.error(context + message)
        if (error) {
            console.error(error)
        }
    },
    done: () => console.log(),
}
