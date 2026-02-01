// Simple test - Voice Command
import https from 'https';

const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8';

function post(path, body, token) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'rucuomtojzifrvplhwja.supabase.co',
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('=== VOICE COMMAND TEST ===\n');

    // Login
    console.log('1. Logging in...');
    const login = await post('/auth/v1/token?grant_type=password', {
        email: 'yuanhuafung2021@gmail.com',
        password: '90989098'
    });

    if (login.status !== 200) {
        console.log('Login failed:', login.data);
        return;
    }
    console.log('   ✅ Login successful\n');
    const token = login.data.access_token;

    // Test voice commands
    const tests = [
        "I need to make a quote",
        "Quote for Mike Chen, deck staining $850",
        "Go to dashboard",
        "Find John Smith",
        "Add a note: replaced hot water system"
    ];

    for (const query of tests) {
        console.log(`\n🎤 Testing: "${query}"`);
        const result = await post('/functions/v1/process-voice-command', {
            query: query,
            conversationHistory: [],
            accumulatedData: {}
        }, token);

        if (result.status === 200) {
            console.log('   ✅ Speak:', result.data.speak);
            console.log('   Action:', result.data.action);
            if (result.data.data) console.log('   Data:', JSON.stringify(result.data.data));
        } else {
            console.log('   ❌ Error:', result.status, result.data);
        }
    }

    console.log('\n=== TEST COMPLETE ===');
}

main().catch(console.error);
