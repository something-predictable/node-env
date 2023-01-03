export interface Reporter {
    status(text: string): void
    error(message: string, file?: string, line?: number, column?: number): void
    fatal(message: string, error: unknown, file?: string): void
}
