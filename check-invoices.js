import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  console.log('📊 Checking database data...\n');

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total')
    .limit(10);

  if (error) {
    console.error('Error fetching invoices:', error);
  } else {
    console.log(`Found ${invoices.length} invoices:`);
    invoices.forEach(inv => {
      console.log(`  - ${inv.invoice_number}: $${inv.total} (${inv.status})`);
      console.log(`    ID: ${inv.id}`);
    });
  }

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, email')
    .limit(10);

  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
  } else {
    console.log(`\nFound ${clients.length} clients:`);
    clients.forEach(client => {
      console.log(`  - ${client.name} (${client.email})`);
    });
  }
}

checkData();
