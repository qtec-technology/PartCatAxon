type ClientLogLevel = 'warn' | 'error';

type ErrorLike = {
    name?: string;
    message?: string;
    stack?: string;
};

const serializeError = (error: unknown): Record<string, unknown> | undefined => {
    if (!error) return undefined;
    if (error instanceof Error) {
        const payload: ErrorLike = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
        return payload;
    }
    return { message: String(error) };
};

const emitClientLog = (
    level: ClientLogLevel,
    event: string,
    error?: unknown,
    context?: Record<string, unknown>
): void => {
    const serializedError = serializeError(error);

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...(serializedError ? { error: serializedError } : {}),
        ...(context ? { context } : {}),
    };

    const payload = JSON.stringify(entry);
    if (level === 'warn') {
        console.warn(payload);
        return;
    }
    console.error(payload);
};

export const clientLogger = {
    warn(event: string, context?: Record<string, unknown>): void {
        emitClientLog('warn', event, undefined, context);
    },
    error(event: string, error?: unknown, context?: Record<string, unknown>): void {
        emitClientLog('error', event, error, context);
    },
} as const;
