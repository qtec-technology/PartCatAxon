type LogLevel = 'info' | 'warn' | 'error';

type ErrorLike = {
    name?: string;
    message?: string;
    stack?: string;
};

type LogContext = Record<string, unknown> | Error | null | undefined;

const serializeError = (error: ErrorLike) => ({
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
    stack: error.stack,
});

const normalizeContext = (context?: LogContext): Record<string, unknown> | undefined => {
    if (!context) return undefined;
    if (context instanceof Error) {
        return { error: serializeError(context) };
    }
    return context;
};

const write = (level: LogLevel, message: string, context?: LogContext): void => {
    const normalizedContext = normalizeContext(context);

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(normalizedContext ? { context: normalizedContext } : {}),
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
        console.error(serialized);
        return;
    }
    if (level === 'warn') {
        console.warn(serialized);
        return;
    }
    console.info(serialized);
};

export const logger = {
    info(message: string, context?: LogContext): void {
        write('info', message, context);
    },
    warn(message: string, context?: LogContext): void {
        write('warn', message, context);
    },
    error(message: string, context?: LogContext): void {
        write('error', message, context);
    },
} as const;
