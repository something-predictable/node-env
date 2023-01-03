export const consoleReporter = {
    status: (message: string) => console.log(message),
    error: (message: string, file?: string, line?: number, column?: number) => {
        let context = ''
        if (file) {
            context += file
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
}
