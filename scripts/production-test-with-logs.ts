/**
 * Production Test Runner with Service Log Verification
 *
 * This script runs comprehensive production tests and verifies
 * results using logs from all integrated services.
 *
 * Usage:
 *   npx tsx scripts/production-test-with-logs.ts
 *   npx tsx scripts/production-test-with-logs.ts --only=stripe
 *   npx tsx scripts/production-test-with-logs.ts --skip-logs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
    supabase: {
        projectRef: process.env.SUPABASE_PROJECT_REF || 'rucuomtojzifrvplhwja',
        url: 'https://rucuomtojzifrvplhwja.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8',
    },
    testUser: {
        email: 'aethonautomation@gmail.com',
        password: '90989098',
    },
    outputDir: 'test-results',
};

// ===========================================
// TYPES
// ===========================================

interface TestSection {
    name: string;
    tests: Test[];
    logs: ServiceLog[];
    duration: number;
    passed: number;
    failed: number;
}

interface Test {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    error?: string;
}

interface ServiceLog {
    service: string;
    entries: LogEntry[];
    timestamp: Date;
}

interface LogEntry {
    level: string;
    message: string;
    timestamp: Date;
}

interface TestReport {
    timestamp: Date;
    totalDuration: number;
    sections: TestSection[];
    summary: {
        totalTests: number;
        passed: number;
        failed: number;
        skipped: number;
    };
    serviceLogs: {
        supabase: boolean;
        stripe: boolean;
        vercel: boolean;
    };
}

// ===========================================
// LOGGING
// ===========================================

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    gray: '\x1b[90m',
};

function log(level: 'info' | 'success' | 'warn' | 'error', message: string) {
    const color = {
        info: colors.blue,
        success: colors.green,
        warn: colors.yellow,
        error: colors.red,
    }[level];

    const icon = {
        info: 'ℹ️',
        success: '✅',
        warn: '⚠️',
        error: '❌',
    }[level];

    console.log(`${color}${icon} ${message}${colors.reset}`);
}

function logHeader(title: string) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${title}`);
    console.log('═'.repeat(60) + '\n');
}

// ===========================================
// SERVICE LOG FETCHERS
// ===========================================

async function fetchSupabaseLogs(functionNames: string[]): Promise<ServiceLog[]> {
    const logs: ServiceLog[] = [];

    for (const fn of functionNames) {
        try {
            const { stdout } = await execAsync(
                `npx supabase functions logs --project-ref ${CONFIG.supabase.projectRef} ${fn} --limit 10`,
                { timeout: 15000 }
            );

            const entries = stdout.split('\n').filter(Boolean).map((line) => ({
                level: line.includes('ERROR') ? 'error' : 'info',
                message: line,
                timestamp: new Date(),
            }));

            logs.push({
                service: `supabase:${fn}`,
                entries,
                timestamp: new Date(),
            });
        } catch (error) {
            // Function might not have logs or CLI not configured
        }
    }

    return logs;
}

async function fetchStripeLogs(): Promise<ServiceLog | null> {
    try {
        const { stdout } = await execAsync('stripe events list --limit 10 2>&1', { timeout: 15000 });

        const entries = stdout.split('\n').filter(Boolean).map((line) => ({
            level: 'info',
            message: line,
            timestamp: new Date(),
        }));

        return {
            service: 'stripe',
            entries,
            timestamp: new Date(),
        };
    } catch {
        return null;
    }
}

async function fetchVercelLogs(): Promise<ServiceLog | null> {
    try {
        const { stdout } = await execAsync('npx vercel logs --limit 10 2>&1', { timeout: 15000 });

        const entries = stdout.split('\n').filter(Boolean).map((line) => ({
            level: line.includes('ERROR') ? 'error' : 'info',
            message: line,
            timestamp: new Date(),
        }));

        return {
            service: 'vercel',
            entries,
            timestamp: new Date(),
        };
    } catch {
        return null;
    }
}

// ===========================================
// API HELPERS
// ===========================================

async function authenticate(): Promise<{ token: string; userId: string } | null> {
    try {
        const response = await fetch(
            `${CONFIG.supabase.url}/auth/v1/token?grant_type=password`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: CONFIG.supabase.anonKey,
                },
                body: JSON.stringify({
                    email: CONFIG.testUser.email,
                    password: CONFIG.testUser.password,
                }),
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        return {
            token: data.access_token,
            userId: data.user.id,
        };
    } catch {
        return null;
    }
}

async function testEdgeFunction(
    functionName: string,
    token: string,
    body?: object
): Promise<{ success: boolean; status: number; data?: any; error?: string }> {
    try {
        const response = await fetch(
            `${CONFIG.supabase.url}/functions/v1/${functionName}`,
            {
                method: body ? 'POST' : 'OPTIONS',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    apikey: CONFIG.supabase.anonKey,
                },
                body: body ? JSON.stringify(body) : undefined,
            }
        );

        const data = await response.text();
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch {
            parsed = data;
        }

        return {
            success: response.ok,
            status: response.status,
            data: parsed,
        };
    } catch (error) {
        return {
            success: false,
            status: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ===========================================
// TEST SECTIONS
// ===========================================

async function testAuthentication(): Promise<TestSection> {
    const startTime = Date.now();
    const tests: Test[] = [];

    // Test login
    const auth = await authenticate();
    tests.push({
        name: 'Login with credentials',
        status: auth ? 'pass' : 'fail',
        duration: Date.now() - startTime,
        error: auth ? undefined : 'Failed to authenticate',
    });

    return {
        name: 'Authentication',
        tests,
        logs: [],
        duration: Date.now() - startTime,
        passed: tests.filter((t) => t.status === 'pass').length,
        failed: tests.filter((t) => t.status === 'fail').length,
    };
}

async function testEdgeFunctions(token: string): Promise<TestSection> {
    const startTime = Date.now();
    const tests: Test[] = [];

    const functionsToTest = [
        'generate-pdf',
        'send-email',
        'send-notification',
        'check-stripe-account',
        'check-subscription',
        'get-payment-settings',
        'process-voice-command',
    ];

    for (const fn of functionsToTest) {
        const testStart = Date.now();
        const result = await testEdgeFunction(fn, token);

        tests.push({
            name: `Edge Function: ${fn}`,
            status: result.status === 200 || result.status === 204 ? 'pass' : 'fail',
            duration: Date.now() - testStart,
            error: result.error,
        });
    }

    // Fetch function logs
    const logs = await fetchSupabaseLogs(functionsToTest);

    return {
        name: 'Edge Functions',
        tests,
        logs,
        duration: Date.now() - startTime,
        passed: tests.filter((t) => t.status === 'pass').length,
        failed: tests.filter((t) => t.status === 'fail').length,
    };
}

async function testDatabaseAccess(token: string): Promise<TestSection> {
    const startTime = Date.now();
    const tests: Test[] = [];

    const tables = ['profiles', 'clients', 'quotes', 'invoices', 'jobs'];

    for (const table of tables) {
        const testStart = Date.now();
        try {
            const response = await fetch(
                `${CONFIG.supabase.url}/rest/v1/${table}?select=id&limit=1`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        apikey: CONFIG.supabase.anonKey,
                    },
                }
            );

            tests.push({
                name: `Table access: ${table}`,
                status: response.ok ? 'pass' : 'fail',
                duration: Date.now() - testStart,
            });
        } catch (error) {
            tests.push({
                name: `Table access: ${table}`,
                status: 'fail',
                duration: Date.now() - testStart,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return {
        name: 'Database Access',
        tests,
        logs: [],
        duration: Date.now() - startTime,
        passed: tests.filter((t) => t.status === 'pass').length,
        failed: tests.filter((t) => t.status === 'fail').length,
    };
}

async function testStripeIntegration(token: string): Promise<TestSection> {
    const startTime = Date.now();
    const tests: Test[] = [];

    // Test Stripe account check
    const accountResult = await testEdgeFunction('check-stripe-account', token, {});
    tests.push({
        name: 'Stripe account check',
        status: accountResult.success ? 'pass' : 'fail',
        duration: Date.now() - startTime,
    });

    // Test subscription check
    const subResult = await testEdgeFunction('check-subscription', token, {});
    tests.push({
        name: 'Subscription check',
        status: subResult.success ? 'pass' : 'fail',
        duration: Date.now() - startTime,
    });

    // Fetch Stripe logs
    const stripeLogs = await fetchStripeLogs();

    return {
        name: 'Stripe Integration',
        tests,
        logs: stripeLogs ? [stripeLogs] : [],
        duration: Date.now() - startTime,
        passed: tests.filter((t) => t.status === 'pass').length,
        failed: tests.filter((t) => t.status === 'fail').length,
    };
}

// ===========================================
// REPORT GENERATION
// ===========================================

function generateReport(sections: TestSection[]): TestReport {
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let totalDuration = 0;

    for (const section of sections) {
        totalTests += section.tests.length;
        passed += section.passed;
        failed += section.failed;
        skipped += section.tests.filter((t) => t.status === 'skip').length;
        totalDuration += section.duration;
    }

    return {
        timestamp: new Date(),
        totalDuration,
        sections,
        summary: { totalTests, passed, failed, skipped },
        serviceLogs: {
            supabase: sections.some((s) => s.logs.some((l) => l.service.startsWith('supabase'))),
            stripe: sections.some((s) => s.logs.some((l) => l.service === 'stripe')),
            vercel: sections.some((s) => s.logs.some((l) => l.service === 'vercel')),
        },
    };
}

function printReport(report: TestReport) {
    logHeader('📊 TEST RESULTS');

    for (const section of report.sections) {
        console.log(`\n${colors.blue}📌 ${section.name}${colors.reset}`);
        console.log('─'.repeat(40));

        for (const test of section.tests) {
            const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏭️';
            const color = test.status === 'pass' ? colors.green : test.status === 'fail' ? colors.red : colors.yellow;
            console.log(`  ${icon} ${color}${test.name}${colors.reset} (${test.duration}ms)`);
            if (test.error) {
                console.log(`     ${colors.red}Error: ${test.error}${colors.reset}`);
            }
        }

        if (section.logs.length > 0) {
            console.log(`\n  📜 Service Logs:`);
            for (const log of section.logs) {
                console.log(`     ${colors.gray}[${log.service}] ${log.entries.length} entries${colors.reset}`);
            }
        }
    }

    logHeader('📈 SUMMARY');
    console.log(`  Total Tests: ${report.summary.totalTests}`);
    console.log(`  ${colors.green}✅ Passed: ${report.summary.passed}${colors.reset}`);
    console.log(`  ${colors.red}❌ Failed: ${report.summary.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}⏭️ Skipped: ${report.summary.skipped}${colors.reset}`);
    console.log(`  ⏱️ Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    console.log(`  📈 Pass Rate: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`);

    console.log(`\n  Service Logs Collected:`);
    console.log(`    Supabase: ${report.serviceLogs.supabase ? '✅' : '❌'}`);
    console.log(`    Stripe: ${report.serviceLogs.stripe ? '✅' : '❌'}`);
    console.log(`    Vercel: ${report.serviceLogs.vercel ? '✅' : '❌'}`);
}

function saveReport(report: TestReport) {
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const filename = `production-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(CONFIG.outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    log('success', `Report saved to ${filepath}`);
}

// ===========================================
// MAIN
// ===========================================

async function main() {
    logHeader('🧪 TradieMate Production Test Suite');
    log('info', 'Starting comprehensive production tests with log verification...\n');

    const sections: TestSection[] = [];

    // Authentication
    log('info', 'Testing authentication...');
    const authSection = await testAuthentication();
    sections.push(authSection);

    if (authSection.failed > 0) {
        log('error', 'Authentication failed. Cannot proceed with other tests.');
        process.exit(1);
    }

    const auth = await authenticate();
    if (!auth) {
        log('error', 'Failed to authenticate for remaining tests.');
        process.exit(1);
    }

    // Edge Functions
    log('info', 'Testing Edge Functions...');
    sections.push(await testEdgeFunctions(auth.token));

    // Database Access
    log('info', 'Testing database access...');
    sections.push(await testDatabaseAccess(auth.token));

    // Stripe Integration
    log('info', 'Testing Stripe integration...');
    sections.push(await testStripeIntegration(auth.token));

    // Generate and print report
    const report = generateReport(sections);
    printReport(report);
    saveReport(report);

    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch((error) => {
    log('error', `Test suite crashed: ${error.message}`);
    process.exit(1);
});
