// Debug test - Voice Command with detailed logging
import https from 'https';

const SUPABASE_URL = 'https://rucuomtojzifrvplhwja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8';

function post(path, body, token, showHeaders = false) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`
        };

        if (showHeaders) {
            console.log('Request headers:', headers);
            console.log('Token length:', token?.length);
            console.log('Token starts with:', token?.substring(0, 30));
        }

        const options = {
            hostname: 'rucuomtojzifrvplhwja.supabase.co',
            port: 443,
            path: path,
            method: 'POST',
            headers
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, data: body, headers: res.headers }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('=== VOICE COMMAND DEBUG TEST ===\n');

    // Login
    console.log('1. Logging in...');
    const login = await post('/auth/v1/token?grant_type=password', {
        email: 'yuanhuafung2021@gmail.com',
        password: '90989098'
    });

    if (login.status !== 200) {
        console.log('Login failed:', login.status, login.data);
        return;
    }
    console.log('   ✅ Login successful');
    const token = login.data.access_token;
    console.log('   Token type:', login.data.token_type);
    console.log('   Token length:', token.length);
    console.log('   Expires in:', login.data.expires_in);
    console.log('   User ID:', login.data.user?.id);

    // Test voice command with detailed logging
    console.log('\n2. Testing voice command with detailed request info...');
    const result = await post('/functions/v1/process-voice-command', {
        query: 'Go to dashboard',
        conversationHistory: [],
        accumulatedData: {}
    }, token, true);

    console.log('\nResponse status:', result.status);
    console.log('Response data:', JSON.stringify(result.data, null, 2));

    // Try with different auth format
    console.log('\n3. Testing with anon key only (no auth)...');
    const anonResult = await post('/functions/v1/process-voice-command', {
        query: 'Go to dashboard',
        conversationHistory: [],
        accumulatedData: {}
    });
    console.log('Anon response status:', anonResult.status);
    console.log('Anon response:', JSON.stringify(anonResult.data, null, 2));

    console.log('\n=== TEST COMPLETE ===');
}

main().catch(console.error);
