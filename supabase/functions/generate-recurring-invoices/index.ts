import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationResult {
  template_id: string;
  new_invoice_id?: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
  user_id: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting recurring invoice generation...');

    // Fetch all recurring invoices that are due today or overdue
    const today = new Date().toISOString().split('T')[0];

    const { data: dueInvoices, error: fetchError } = await supabase
      .from('invoices')
      .select('*, clients(*), profiles!user_id(*)')
      .eq('is_recurring', true)
      .lte('next_due_date', today)
      .neq('status', 'cancelled')
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Error fetching due invoices:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${dueInvoices?.length || 0} invoices to process`);

    const results: GenerationResult[] = [];

    for (const template of dueInvoices || []) {
      console.log(`Processing invoice ${template.id} for user ${template.user_id}`);

      try {
        // Check subscription limits
        const tier = template.profiles?.subscription_tier || 'free';
        const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM format

        const { data: usage } = await supabase
          .from('usage_tracking')
          .select('*')
          .eq('user_id', template.user_id)
          .eq('month_year', monthYear)
          .maybeSingle();

        const invoiceLimit = getInvoiceLimit(tier);
        const currentUsage = usage?.invoices_created || 0;

        if (invoiceLimit !== -1 && currentUsage >= invoiceLimit) {
          console.log(`Skipping - user ${template.user_id} has reached invoice limit (${currentUsage}/${invoiceLimit})`);
          results.push({
            template_id: template.id,
            status: 'skipped',
            reason: 'limit_reached',
            user_id: template.user_id
          });
          continue;
        }

        // Generate new invoice number
        const { data: lastInvoice } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('user_id', template.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const newInvoiceNumber = generateNextNumber(lastInvoice?.invoice_number, template.invoice_number);

        // Calculate new due date
        const newDueDate = calculateNextDueDate(
          new Date(),
          template.recurring_interval
        );

        console.log(`Creating new invoice ${newInvoiceNumber} with due date ${newDueDate}`);

        // Create new invoice
        const { data: newInvoice, error: insertError } = await supabase
          .from('invoices')
          .insert({
            user_id: template.user_id,
            client_id: template.client_id,
            job_id: template.job_id,
            quote_id: template.quote_id,
            invoice_number: newInvoiceNumber,
            title: template.title,
            description: template.description,
            subtotal: template.subtotal,
            gst: template.gst,
            total: template.total,
            due_date: newDueDate,
            notes: template.notes,
            terms: template.terms,
            status: 'sent', // Auto-send generated invoices
            sent_at: new Date().toISOString(),
            parent_invoice_id: template.id,
            is_recurring: false, // Generated invoices are not themselves recurring
            recurring_interval: null,
            next_due_date: null,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error creating invoice:`, insertError);
          results.push({
            template_id: template.id,
            status: 'error',
            user_id: template.user_id,
            error: insertError.message
          });
          continue;
        }

        // Copy line items
        const { data: lineItems } = await supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', template.id);

        if (lineItems && lineItems.length > 0) {
          const { error: lineItemsError } = await supabase
            .from('invoice_line_items')
            .insert(
              lineItems.map((item: any) => ({
                invoice_id: newInvoice.id,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                total: item.total,
                item_type: item.item_type,
                sort_order: item.sort_order,
              }))
            );

          if (lineItemsError) {
            console.error('Error copying line items:', lineItemsError);
          }
        }

        // Update usage tracking
        if (usage) {
          await supabase
            .from('usage_tracking')
            .update({ invoices_created: currentUsage + 1 })
            .eq('user_id', template.user_id)
            .eq('month_year', monthYear);
        } else {
          await supabase
            .from('usage_tracking')
            .insert({
              user_id: template.user_id,
              month_year: monthYear,
              invoices_created: 1,
              quotes_created: 0,
              jobs_created: 0,
              emails_sent: 0,
              sms_sent: 0,
              clients_created: 0,
            });
        }

        // Send email to client if they have an email address
        if (template.clients?.email) {
          console.log(`Sending email to ${template.clients.email}`);
          try {
            const { error: emailError } = await supabase.functions.invoke('send-email', {
              body: {
                type: 'invoice',
                id: newInvoice.id,
                recipient_email: template.clients.email,
                recipient_name: template.clients.name,
              },
            });

            if (emailError) {
              console.error('Error sending email:', emailError);
              // Don't fail the whole process if email fails
            }
          } catch (emailErr) {
            console.error('Exception sending email:', emailErr);
          }
        }

        // Update template's next due date
        const nextDueDate = calculateNextDueDate(
          new Date(template.next_due_date),
          template.recurring_interval
        );

        console.log(`Updating template next_due_date to ${nextDueDate}`);

        await supabase
          .from('invoices')
          .update({ next_due_date: nextDueDate })
          .eq('id', template.id);

        results.push({
          template_id: template.id,
          new_invoice_id: newInvoice.id,
          status: 'created',
          user_id: template.user_id,
        });

        console.log(`Successfully created invoice ${newInvoice.id}`);

      } catch (error) {
        console.error(`Error processing template ${template.id}:`, error);
        results.push({
          template_id: template.id,
          status: 'error',
          user_id: template.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Completed processing. Results:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('Fatal error in generate-recurring-invoices:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getInvoiceLimit(tier: string): number {
  const limits: Record<string, number> = {
    free: 5,
    solo: 50,
    crew: -1, // unlimited
    pro: -1,  // unlimited
  };
  return limits[tier] ?? limits.free;
}

function generateNextNumber(lastNumber?: string, templateNumber?: string): string {
  // If we have a last number, increment it
  if (lastNumber) {
    const match = lastNumber.match(/INV(\d{8})-([A-Z0-9]{4})/);
    if (match) {
      const nextSeq = parseInt(match[2], 36) + 1;
      const nextCode = nextSeq.toString(36).toUpperCase().padStart(4, '0');
      return `INV${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${nextCode}`;
    }
  }

  // Otherwise generate a new one
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV${dateStr}-${randomStr}`;
}

function calculateNextDueDate(currentDate: Date, interval: string): string {
  const date = new Date(currentDate);

  switch (interval) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'fortnightly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      // Default to monthly if interval is unknown
      date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().split('T')[0];
}
