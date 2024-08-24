import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { styleText } from 'node:util'

const cwd = process.cwd()

export const consoleReporter = {
    status: (message: string) => {
        console.log(message)
    },
    error: (message: string, file?: string, line?: number, column?: number) => {
        let context = ''
        if (file) {
            const f = relative(cwd, file.startsWith('file://') ? fileURLToPath(file) : file)
            let point = ''
            if (line) {
                point = ':' + line.toString()
                if (column) {
                    point += ':' + column.toString()
                }
            }
            context = styleText('blueBright', f) + styleText('grey', point + ' - ')
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
    done: () => {
        console.log()
    },
}
