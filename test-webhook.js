// Test script to simulate webhook and update invoice
const invoice_id = "d8a246e5-9ebd-43a5-9e6f-ff13ca1ca8bf"; // From screenshot
console.log("Testing invoice update for:", invoice_id);
console.log("\nTo test manually, run this SQL in Supabase:");
console.log(`
UPDATE invoices 
SET status = 'paid',
    amount_paid = total,
    paid_at = NOW()
WHERE id = '${invoice_id}';
`);
