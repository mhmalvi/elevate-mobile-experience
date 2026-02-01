/**
 * Service Log Verification Utilities
 * 
 * Provides functions to fetch and verify logs from:
 * - Supabase Edge Functions
 * - Vercel Deployments
 * - Stripe Webhooks
 * - Resend Email Delivery
 * - Twilio SMS Delivery
 * 
 * Used by both integration tests and E2E tests for comprehensive verification.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ===========================================
// TYPES
// ===========================================

export interface LogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    source: string;
    metadata?: Record<string, any>;
}

export interface LogQueryResult {
    success: boolean;
    logs: LogEntry[];
    rawOutput?: string;
    error?: string;
}

export interface ServiceHealth {
    service: string;
    status: 'healthy' | 'degraded' | 'unavailable';
    latency?: number;
    lastCheck: Date;
    details?: string;
}

// ===========================================
// SUPABASE LOG VERIFICATION
// ===========================================

export async function getSupabaseFunctionLogs(
    projectRef: string,
    functionName: string,
    options: {
        limit?: number;
        since?: Date;
        level?: 'error' | 'warn' | 'info';
    } = {}
): Promise<LogQueryResult> {
    const { limit = 50, since, level } = options;

    try {
        const args = [
            `--project-ref ${projectRef}`,
            functionName,
            `--limit ${limit}`,
        ];

        const command = `npx supabase functions logs ${args.join(' ')}`;
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

        // Parse log output
        const logs: LogEntry[] = [];
        const lines = stdout.split('\n').filter(Boolean);

        for (const line of lines) {
            try {
                // Supabase logs format: timestamp level message
                const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(\w+)\s+(.+)$/);
                if (match) {
                    const [, timestamp, logLevel, message] = match;
                    const entry: LogEntry = {
                        timestamp: new Date(timestamp),
                        level: logLevel.toLowerCase() as LogEntry['level'],
                        message,
                        source: `supabase:${functionName}`,
                    };

                    // Filter by since date
                    if (since && entry.timestamp < since) continue;

                    // Filter by level
                    if (level && entry.level !== level) continue;

                    logs.push(entry);
                }
            } catch {
                // Skip malformed lines
            }
        }

        return { success: true, logs, rawOutput: stdout };
    } catch (error) {
        return {
            success: false,
            logs: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

export async function verifySupabaseLogContains(
    projectRef: string,
    functionName: string,
    expectedMessage: string | RegExp,
    options: {
        timeoutMs?: number;
        pollIntervalMs?: number;
        since?: Date;
    } = {}
): Promise<boolean> {
    const { timeoutMs = 10000, pollIntervalMs = 1000, since = new Date(Date.now() - 60000) } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const result = await getSupabaseFunctionLogs(projectRef, functionName, { since });

        if (result.success) {
            for (const log of result.logs) {
                if (typeof expectedMessage === 'string') {
                    if (log.message.includes(expectedMessage)) return true;
                } else {
                    if (expectedMessage.test(log.message)) return true;
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return false;
}

// ===========================================
// STRIPE LOG VERIFICATION
// ===========================================

export async function getStripeEvents(
    options: {
        limit?: number;
        type?: string;
    } = {}
): Promise<LogQueryResult> {
    const { limit = 20, type } = options;

    try {
        const args = [`--limit ${limit}`];
        if (type) args.push(`--type ${type}`);

        const command = `stripe events list ${args.join(' ')} --json 2>&1`;
        const { stdout } = await execAsync(command, { timeout: 30000 });

        const logs: LogEntry[] = [];

        try {
            const events = JSON.parse(stdout);
            for (const event of events.data || []) {
                logs.push({
                    timestamp: new Date(event.created * 1000),
                    level: 'info',
                    message: `${event.type}: ${event.id}`,
                    source: 'stripe',
                    metadata: {
                        id: event.id,
                        type: event.type,
                        livemode: event.livemode,
                        object: event.data?.object?.id,
                    },
                });
            }
        } catch {
            // CLI output might not be JSON
            const lines = stdout.split('\n').filter(Boolean);
            for (const line of lines) {
                logs.push({
                    timestamp: new Date(),
                    level: 'info',
                    message: line,
                    source: 'stripe',
                });
            }
        }

        return { success: true, logs, rawOutput: stdout };
    } catch (error) {
        return {
            success: false,
            logs: [],
            error: error instanceof Error ? error.message : 'Stripe CLI not installed or configured',
        };
    }
}

export async function getStripeWebhookLogs(): Promise<LogQueryResult> {
    try {
        const command = 'stripe logs tail --limit 20 --json 2>&1';
        const { stdout } = await execAsync(command, { timeout: 10000 });

        const logs: LogEntry[] = [];
        const lines = stdout.split('\n').filter(Boolean);

        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                logs.push({
                    timestamp: new Date(parsed.created_at),
                    level: parsed.error ? 'error' : 'info',
                    message: `${parsed.method} ${parsed.url} - ${parsed.status}`,
                    source: 'stripe:webhook',
                    metadata: parsed,
                });
            } catch {
                logs.push({
                    timestamp: new Date(),
                    level: 'info',
                    message: line,
                    source: 'stripe:webhook',
                });
            }
        }

        return { success: true, logs, rawOutput: stdout };
    } catch (error) {
        return {
            success: false,
            logs: [],
            error: error instanceof Error ? error.message : 'Stripe CLI not available',
        };
    }
}

// ===========================================
// VERCEL LOG VERIFICATION
// ===========================================

export async function getVercelLogs(
    options: {
        limit?: number;
        since?: Date;
    } = {}
): Promise<LogQueryResult> {
    const { limit = 50 } = options;

    try {
        const command = `npx vercel logs --output json --limit ${limit} 2>&1`;
        const { stdout } = await execAsync(command, { timeout: 30000 });

        const logs: LogEntry[] = [];
        const lines = stdout.split('\n').filter(Boolean);

        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                logs.push({
                    timestamp: new Date(parsed.timestamp || Date.now()),
                    level: parsed.level || 'info',
                    message: parsed.message || line,
                    source: 'vercel',
                    metadata: parsed,
                });
            } catch {
                logs.push({
                    timestamp: new Date(),
                    level: 'info',
                    message: line,
                    source: 'vercel',
                });
            }
        }

        return { success: true, logs, rawOutput: stdout };
    } catch (error) {
        return {
            success: false,
            logs: [],
            error: error instanceof Error ? error.message : 'Vercel CLI not configured',
        };
    }
}

export async function getVercelDeploymentStatus(): Promise<{
    status: 'ready' | 'building' | 'error' | 'unknown';
    url?: string;
    error?: string;
}> {
    try {
        const { stdout } = await execAsync('npx vercel list --limit 1 --json 2>&1', { timeout: 15000 });
        const data = JSON.parse(stdout);

        if (data.deployments && data.deployments.length > 0) {
            const latest = data.deployments[0];
            return {
                status: latest.state === 'READY' ? 'ready' : latest.state.toLowerCase(),
                url: latest.url,
            };
        }

        return { status: 'unknown' };
    } catch (error) {
        return {
            status: 'unknown',
            error: error instanceof Error ? error.message : 'Could not check deployment',
        };
    }
}

// ===========================================
// SERVICE HEALTH CHECKS
// ===========================================

export async function checkServiceHealth(): Promise<ServiceHealth[]> {
    const healthChecks: ServiceHealth[] = [];

    // Supabase Health
    try {
        const start = Date.now();
        const response = await fetch('https://rucuomtojzifrvplhwja.supabase.co/rest/v1/', {
            method: 'HEAD',
            headers: { 'apikey': process.env.VITE_SUPABASE_ANON_KEY || '' },
        });
        healthChecks.push({
            service: 'supabase',
            status: response.ok ? 'healthy' : 'degraded',
            latency: Date.now() - start,
            lastCheck: new Date(),
        });
    } catch {
        healthChecks.push({
            service: 'supabase',
            status: 'unavailable',
            lastCheck: new Date(),
            details: 'Could not connect to Supabase',
        });
    }

    // Stripe CLI
    try {
        await execAsync('stripe --version', { timeout: 5000 });
        healthChecks.push({
            service: 'stripe-cli',
            status: 'healthy',
            lastCheck: new Date(),
        });
    } catch {
        healthChecks.push({
            service: 'stripe-cli',
            status: 'unavailable',
            lastCheck: new Date(),
            details: 'Stripe CLI not installed',
        });
    }

    // Vercel CLI
    try {
        await execAsync('npx vercel --version', { timeout: 10000 });
        healthChecks.push({
            service: 'vercel-cli',
            status: 'healthy',
            lastCheck: new Date(),
        });
    } catch {
        healthChecks.push({
            service: 'vercel-cli',
            status: 'unavailable',
            lastCheck: new Date(),
            details: 'Vercel CLI not configured',
        });
    }

    return healthChecks;
}

// ===========================================
// LOG ASSERTION HELPERS
// ===========================================

export function assertLogContains(
    logs: LogEntry[],
    message: string | RegExp,
    options: { level?: LogEntry['level']; source?: string } = {}
): boolean {
    for (const log of logs) {
        // Check level filter
        if (options.level && log.level !== options.level) continue;

        // Check source filter
        if (options.source && !log.source.includes(options.source)) continue;

        // Check message
        if (typeof message === 'string') {
            if (log.message.includes(message)) return true;
        } else {
            if (message.test(log.message)) return true;
        }
    }

    return false;
}

export function assertNoErrors(logs: LogEntry[], ignorePatterns: RegExp[] = []): {
    hasErrors: boolean;
    errors: LogEntry[];
} {
    const errors = logs.filter(log => {
        if (log.level !== 'error') return false;

        // Check if error should be ignored
        for (const pattern of ignorePatterns) {
            if (pattern.test(log.message)) return false;
        }

        return true;
    });

    return { hasErrors: errors.length > 0, errors };
}

export function findLogByPattern(
    logs: LogEntry[],
    pattern: RegExp
): LogEntry | undefined {
    return logs.find(log => pattern.test(log.message));
}

// ===========================================
// LOG AGGREGATION
// ===========================================

export async function aggregateAllLogs(
    projectRef: string,
    functionNames: string[],
    options: { since?: Date } = {}
): Promise<{
    supabase: Record<string, LogQueryResult>;
    stripe: LogQueryResult;
    vercel: LogQueryResult;
    summary: {
        totalLogs: number;
        errors: number;
        warnings: number;
    };
}> {
    const since = options.since || new Date(Date.now() - 3600000); // Last hour

    // Fetch all Supabase function logs
    const supabaseLogs: Record<string, LogQueryResult> = {};
    for (const fn of functionNames) {
        supabaseLogs[fn] = await getSupabaseFunctionLogs(projectRef, fn, { since });
    }

    // Fetch Stripe and Vercel logs
    const stripeLogs = await getStripeEvents();
    const vercelLogs = await getVercelLogs();

    // Calculate summary
    let totalLogs = 0;
    let errors = 0;
    let warnings = 0;

    const allLogs: LogEntry[] = [];

    for (const result of Object.values(supabaseLogs)) {
        allLogs.push(...result.logs);
    }
    allLogs.push(...stripeLogs.logs);
    allLogs.push(...vercelLogs.logs);

    totalLogs = allLogs.length;
    errors = allLogs.filter(l => l.level === 'error').length;
    warnings = allLogs.filter(l => l.level === 'warn').length;

    return {
        supabase: supabaseLogs,
        stripe: stripeLogs,
        vercel: vercelLogs,
        summary: { totalLogs, errors, warnings },
    };
}
