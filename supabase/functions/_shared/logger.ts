/**
 * Structured Logger for Edge Functions
 * 
 * Provides JSON-formatted logging with consistent fields for observability.
 * In production (Supabase), these JSON logs are parsed by log aggregators.
 * In development, they're still human-readable.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    /** The edge function name */
    fn: string;
    /** Optional user ID for audit trail */
    userId?: string;
    /** Optional request ID for tracing */
    requestId?: string;
    /** Additional structured data */
    [key: string]: unknown;
}

interface LogEntry {
    level: LogLevel;
    message: string;
    fn: string;
    timestamp: string;
    userId?: string;
    requestId?: string;
    data?: Record<string, unknown>;
    error?: {
        message: string;
        type?: string;
        code?: string;
        stack?: string;
    };
}

export function createLogger(functionName: string) {
    let requestId: string | undefined;
    let userId: string | undefined;

    function buildEntry(
        level: LogLevel,
        message: string,
        data?: Record<string, unknown>,
        error?: unknown
    ): LogEntry {
        const entry: LogEntry = {
            level,
            message,
            fn: functionName,
            timestamp: new Date().toISOString(),
        };

        if (requestId) entry.requestId = requestId;
        if (userId) entry.userId = userId;
        if (data && Object.keys(data).length > 0) entry.data = data;

        if (error) {
            if (error instanceof Error) {
                entry.error = {
                    message: error.message,
                    type: error.constructor.name,
                    stack: error.stack,
                };
            } else if (typeof error === 'object' && error !== null) {
                entry.error = {
                    message: String(error),
                    type: (error as any).type,
                    code: (error as any).code,
                };
            } else {
                entry.error = { message: String(error) };
            }
        }

        return entry;
    }

    return {
        /** Set the request ID for tracing across log entries */
        setRequestId(id: string) {
            requestId = id;
        },

        /** Set the user ID for audit trail */
        setUserId(id: string) {
            userId = id;
        },

        /** Debug-level log — only shown in development. Skipped in production to reduce noise. */
        debug(message: string, data?: Record<string, unknown>) {
            // Only log debug in dev environments
            const isDev = Deno.env.get('ENVIRONMENT') === 'development' || Deno.env.get('DENO_ENV') === 'development';
            if (isDev) {
                console.log(JSON.stringify(buildEntry('debug', message, data)));
            }
        },

        /** Info-level log — for normal operational events */
        info(message: string, data?: Record<string, unknown>) {
            console.log(JSON.stringify(buildEntry('info', message, data)));
        },

        /** Warn-level log — for unexpected but non-fatal conditions */
        warn(message: string, data?: Record<string, unknown>) {
            console.warn(JSON.stringify(buildEntry('warn', message, data)));
        },

        /** Error-level log — for failures. Accepts an error object for stack traces. */
        error(message: string, error?: unknown, data?: Record<string, unknown>) {
            console.error(JSON.stringify(buildEntry('error', message, data, error)));
        },
    };
}
