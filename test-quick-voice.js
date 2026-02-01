/**
 * TradieMate - Quick Voice Command Test
 * Tests the updated process-voice-command Edge Function
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

    console.log('Login response status:', response.status);
    if (response.status === 200 && response.data.access_token) {
        console.log('✅ Login successful');
        console.log('Token preview:', response.data.access_token.substring(0, 50) + '...');
        return response.data.access_token;
    } else {
        console.log('Login response:', JSON.stringify(response.data, null, 2));
        throw new Error('Login failed');
    }
}

async function testVoiceCommand(token, query) {
    console.log(`\n🎙️ Testing: "${query}"`);

    const response = await makeRequest(`${SUPABASE_URL}/functions/v1/process-voice-command`, {
        method: 'POST',
        token,
        body: {
            query: query,
            conversationHistory: [],
            accumulatedData: {}
        }
    });

    console.log(`   Status: ${response.status}`);
    if (response.status === 200) {
        console.log(`   ✅ Speak: "${response.data.speak}"`);
        console.log(`   Action: ${response.data.action}`);
        if (response.data.data && Object.keys(response.data.data).length > 0) {
            console.log(`   Data:`, JSON.stringify(response.data.data, null, 2));
        }
        return true;
    } else {
        console.log(`   ❌ Error:`, JSON.stringify(response.data));
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 TradieMate - Voice Command Quick Test');
    console.log('='.repeat(60));

    try {
        const token = await login();

        // Quick tests
        const tests = [
            "I need to make a quote",
            "New quote for John Smith",
            "Quote for Mike Chen, deck staining $850",
            "Go to dashboard",
            "Find John Smith",
            "Add a note: replaced the hot water system",
            "Thanks mate"
        ];

        let passed = 0;
        for (const query of tests) {
            const success = await testVoiceCommand(token, query);
            if (success) passed++;
            await new Promise(r => setTimeout(r, 1000)); // delay between tests
        }

        console.log('\n' + '='.repeat(60));
        console.log(`📊 Results: ${passed}/${tests.length} passed`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

main();
