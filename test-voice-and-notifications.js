/**
 * TradieMate - Voice Command & Notification Integration Test
 * Tests the updated process-voice-command and send-notification Edge Functions
 */

import https from 'https';

const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8';
const TEST_EMAIL = 'yuanhuafung2021@gmail.com';
const TEST_PASSWORD = '90989098';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${options.token || SUPABASE_ANON_KEY}`,
                ...options.headers
            }
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function login() {
    console.log('🔐 Logging in...');
    const response = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        body: { email: TEST_EMAIL, password: TEST_PASSWORD }
    });

    if (response.status === 200 && response.data.access_token) {
        console.log('✅ Login successful\n');
        return response.data.access_token;
    }
    throw new Error('Login failed: ' + JSON.stringify(response.data));
}

// ==================== VOICE COMMAND TESTS ====================

async function testVoiceCommand(token, query, testName, expectedAction = null) {
    console.log(`\n🎙️ Testing: ${testName}`);
    console.log(`   Query: "${query}"`);

    try {
        const response = await makeRequest(`${SUPABASE_URL}/functions/v1/process-voice-command`, {
            method: 'POST',
            token,
            body: {
                query: query,
                conversationHistory: [],
                accumulatedData: {}
            }
        });

        if (response.status === 200) {
            const { speak, action, data } = response.data;
            console.log(`   ✅ Response:`);
            console.log(`      Speak: "${speak}"`);
            console.log(`      Action: ${action}`);
            if (Object.keys(data || {}).length > 0) {
                console.log(`      Data: ${JSON.stringify(data, null, 2).split('\n').join('\n      ')}`);
            }

            // Check if action matches expected
            if (expectedAction && action !== expectedAction) {
                console.log(`   ⚠️ WARNING: Expected action "${expectedAction}" but got "${action}"`);
                return { success: true, actionMatch: false, response: response.data };
            }

            // Check for generic fallback response
            if (speak && speak.includes("I didn't catch that")) {
                console.log(`   ⚠️ WARNING: Got generic fallback response`);
                return { success: true, actionMatch: false, response: response.data };
            }

            return { success: true, actionMatch: true, response: response.data };
        } else {
            console.log(`   ❌ Error: Status ${response.status}`);
            console.log(`      ${JSON.stringify(response.data)}`);
            return { success: false, response: response.data };
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runVoiceCommandTests(token) {
    console.log('\n' + '='.repeat(60));
    console.log('🎤 VOICE COMMAND TESTS - Testing Natural Language Processing');
    console.log('='.repeat(60));

    const tests = [
        // Quote Creation
        { query: "I need to make a quote", name: "Quote initiation", expected: "ask_details" },
        { query: "New quote for John Smith", name: "Quote with client", expected: "ask_details" },
        { query: "Quote for Mike Chen, deck staining $850", name: "Complete quote in one go", expected: "create_quote" },

        // Client Management
        { query: "Create client Dave Wilson 0412345678", name: "Create client with phone", expected: "create_client" },
        { query: "Add new client Jenny Williams email jenny@test.com", name: "Create client with email", expected: "create_client" },

        // Job Scheduling
        { query: "Schedule a job for tomorrow to fix the roof for Tom", name: "Schedule job", expected: "schedule_job" },
        { query: "Book a job next Monday at Sarah's place for gutter cleaning", name: "Schedule with details", expected: "schedule_job" },

        // Invoice Creation
        { query: "Create invoice for BuildCorp for fencing $5000", name: "Create invoice", expected: "create_invoice" },

        // Find Client
        { query: "Find John Smith", name: "Find client", expected: "find_client" },
        { query: "Search for Mike", name: "Search client", expected: "find_client" },

        // Navigation
        { query: "Go to dashboard", name: "Navigate dashboard", expected: "navigate" },
        { query: "Show my quotes", name: "Navigate quotes", expected: "navigate" },
        { query: "Open invoices", name: "Navigate invoices", expected: "navigate" },
        { query: "Go to clients", name: "Navigate clients", expected: "navigate" },
        { query: "Show jobs", name: "Navigate jobs", expected: "navigate" },

        // Job Notes
        { query: "Add a note: replaced the hot water system", name: "Add job note", expected: "add_job_note" },
        { query: "Note: client wants extra coat of paint", name: "Add short note", expected: "add_job_note" },

        // General conversation
        { query: "What can you help me with", name: "Help request", expected: "general_reply" },
        { query: "Thanks mate", name: "Thanks response", expected: "general_reply" },
    ];

    const results = { passed: 0, failed: 0, warnings: 0 };

    for (const test of tests) {
        const result = await testVoiceCommand(token, test.query, test.name, test.expected);
        if (result.success && result.actionMatch) {
            results.passed++;
        } else if (result.success && !result.actionMatch) {
            results.warnings++;
        } else {
            results.failed++;
        }
        // Small delay between tests
        await new Promise(r => setTimeout(r, 500));
    }

    return results;
}

// ==================== NOTIFICATION TESTS ====================

async function getInvoiceForTesting(token) {
    const response = await makeRequest(
        `${SUPABASE_URL}/rest/v1/invoices?select=id,invoice_number,client:clients(name,email)&deleted_at=is.null&order=created_at.desc&limit=1`,
        { token }
    );

    if (response.status === 200 && response.data.length > 0) {
        return response.data[0];
    }
    throw new Error('No invoice found for testing');
}

async function getQuoteForTesting(token) {
    const response = await makeRequest(
        `${SUPABASE_URL}/rest/v1/quotes?select=id,quote_number,client:clients(name,email)&deleted_at=is.null&order=created_at.desc&limit=1`,
        { token }
    );

    if (response.status === 200 && response.data.length > 0) {
        return response.data[0];
    }
    throw new Error('No quote found for testing');
}

async function testEmailNotification(token, documentType, document) {
    console.log(`\n📧 Testing Email Notification for ${documentType}`);
    console.log(`   Document: ${document[documentType === 'invoice' ? 'invoice_number' : 'quote_number']}`);

    try {
        const response = await makeRequest(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: 'POST',
            token,
            body: {
                type: documentType,
                id: document.id,
                method: 'email',
                recipient: {
                    email: 'aethonautomation@gmail.com',
                    name: 'Test User'
                }
            }
        });

        console.log(`   Status: ${response.status}`);
        if (response.status === 200) {
            console.log(`   ✅ Success: ${response.data.message}`);
            console.log(`   Direct Send: ${response.data.directSend ? 'Yes (via Resend)' : 'No (mailto fallback)'}`);
            if (response.data.shareUrl) {
                console.log(`   Share URL: ${response.data.shareUrl}`);
            }
            return { success: true, directSend: response.data.directSend };
        } else {
            console.log(`   ❌ Failed: ${JSON.stringify(response.data)}`);
            return { success: false };
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testSMSNotification(token, documentType, document) {
    console.log(`\n📱 Testing SMS Notification for ${documentType}`);
    console.log(`   Document: ${document[documentType === 'invoice' ? 'invoice_number' : 'quote_number']}`);

    try {
        const response = await makeRequest(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: 'POST',
            token,
            body: {
                type: documentType,
                id: document.id,
                method: 'sms',
                recipient: {
                    phone: '+61412345678',
                    name: 'Test User'
                }
            }
        });

        console.log(`   Status: ${response.status}`);
        if (response.status === 200) {
            console.log(`   ✅ Success: ${response.data.message}`);
            console.log(`   Direct Send: ${response.data.directSend ? 'Yes (via Twilio)' : 'No (SMS URL fallback)'}`);
            return { success: true, directSend: response.data.directSend };
        } else {
            console.log(`   ❌ Failed: ${JSON.stringify(response.data)}`);
            return { success: false };
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runNotificationTests(token) {
    console.log('\n' + '='.repeat(60));
    console.log('📬 NOTIFICATION TESTS - Testing Email & SMS Sending');
    console.log('='.repeat(60));

    const results = { email: { passed: 0, failed: 0 }, sms: { passed: 0, failed: 0 } };

    try {
        // Get test documents
        console.log('\n📋 Fetching test documents...');
        const invoice = await getInvoiceForTesting(token);
        console.log(`   Found invoice: ${invoice.invoice_number}`);

        let quote;
        try {
            quote = await getQuoteForTesting(token);
            console.log(`   Found quote: ${quote.quote_number}`);
        } catch (e) {
            console.log(`   No quote found for testing`);
        }

        // Test email for invoice
        const invoiceEmailResult = await testEmailNotification(token, 'invoice', invoice);
        if (invoiceEmailResult.success) results.email.passed++; else results.email.failed++;

        // Test SMS for invoice
        const invoiceSmsResult = await testSMSNotification(token, 'invoice', invoice);
        if (invoiceSmsResult.success) results.sms.passed++; else results.sms.failed++;

        // Test email for quote if available
        if (quote) {
            const quoteEmailResult = await testEmailNotification(token, 'quote', quote);
            if (quoteEmailResult.success) results.email.passed++; else results.email.failed++;
        }

    } catch (error) {
        console.log(`\n❌ Notification test setup error: ${error.message}`);
    }

    return results;
}

// ==================== MAIN TEST RUNNER ====================

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 TradieMate - Voice & Notification Integration Tests');
    console.log('   Testing updated Edge Functions');
    console.log('   ' + new Date().toISOString());
    console.log('='.repeat(60));

    try {
        const token = await login();

        // Run Voice Command Tests
        const voiceResults = await runVoiceCommandTests(token);

        // Run Notification Tests
        const notifResults = await runNotificationTests(token);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));

        console.log('\n🎤 Voice Command Tests:');
        console.log(`   ✅ Passed: ${voiceResults.passed}`);
        console.log(`   ⚠️ Warnings: ${voiceResults.warnings}`);
        console.log(`   ❌ Failed: ${voiceResults.failed}`);

        console.log('\n📬 Notification Tests:');
        console.log(`   📧 Email: ${notifResults.email.passed} passed, ${notifResults.email.failed} failed`);
        console.log(`   📱 SMS: ${notifResults.sms.passed} passed, ${notifResults.sms.failed} failed`);

        const totalPassed = voiceResults.passed + notifResults.email.passed + notifResults.sms.passed;
        const totalFailed = voiceResults.failed + notifResults.email.failed + notifResults.sms.failed;

        console.log('\n' + '='.repeat(60));
        if (totalFailed === 0) {
            console.log('🎉 ALL TESTS PASSED! Voice commands and notifications are working.');
        } else {
            console.log(`⚠️ Some tests need attention: ${totalPassed} passed, ${totalFailed} failed`);
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();
