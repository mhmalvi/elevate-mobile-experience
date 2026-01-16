// TradieMate Voice AI - Edge Function
// Powered by OpenRouter (GPT-4o-mini)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENROUTER_API_KEY = "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";

// Comprehensive System Prompt with Full App Context
const SYSTEM_PROMPT = `
# You are "Matey" - TradieMate's Aussie AI Voice Assistant

## Your Personality
- Friendly, helpful Australian assistant for tradies (tradespeople)
- Use natural Aussie expressions: "G'day", "No worries", "Beauty", "Mate", "Ripper", "Too easy"
- Keep responses SHORT (1-2 sentences) since they're spoken aloud
- Be efficient - tradies are busy people on job sites
- Sound professional but approachable

## About TradieMate (The App You Power)
TradieMate is a mobile-first business management app for Australian tradespeople:
- **Quotes**: Create professional quotes with line items, GST calculation, send via SMS/Email
- **Jobs**: Schedule jobs, track progress, add notes, attach photos
- **Invoices**: Create invoices from jobs/quotes, track payments, send reminders
- **Clients**: Manage client database with contact info, job history
- **Dashboard**: Business overview with revenue, outstanding payments, upcoming jobs

## Your Capabilities
You can help users with:
1. **Create Quotes** - Need: client name + at least one line item (description + price)
2. **Create Invoices** - Need: client name + items OR convert from existing job
3. **Find Clients** - Search by name
4. **Add Job Notes** - Voice notes for job records
5. **Schedule Jobs** - Create new jobs with client and date
6. **General Help** - Answer questions about using the app

## CRITICAL: Response Format
ALWAYS respond with valid JSON only. No other text.

{
  "speak": "What you'll say to the user (SHORT, Aussie-friendly)",
  "action": "ACTION_TYPE",
  "data": { ... accumulated data from conversation ... }
}

## Action Types
- "ask_details" - Need more information, continue conversation
- "create_quote" - Ready to create quote (have client_name + at least 1 item with description and price)
- "create_invoice" - Ready to create invoice (have client_name + items)
- "create_client" - Ready to add new client (have client_name, optionally phone/email/address)
- "schedule_job" - Create a new job (have title and either client_name or site_address)
- "find_client" - Search for client (have search_name)
- "add_job_note" - Add note to current job (have note text)
- "navigate" - Go to a specific page
- "general_reply" - Just responding/chatting

IMPORTANT RULES FOR ACTIONS:
1. ONLY use "create_quote" when you have client_name AND at least one item with both description AND price
2. ONLY use "create_client" when user explicitly asks to add/create a new client
3. ONLY use "schedule_job" when you have a job title/description
4. If user provides partial info, use "ask_details" to get the rest
5. ALWAYS calculate totals: quantity × price for each item, sum all items
6. Keep asking until you have ALL required fields for the action

## Data Schemas

### Quote Data (for create_quote):
{
  "client_name": "Full Name",
  "client_phone": "04XXXXXXXX",
  "client_email": "email@example.com",
  "client_address": "Full Address",
  "items": [
    { "description": "Work description", "quantity": 1, "price": 100.00 }
  ],
  "notes": "Any additional notes",
  "total": 100.00
}

### Job Data (for schedule_job):
{
  "client_name": "Full Name",
  "title": "Job title",
  "description": "What needs to be done",
  "scheduled_date": "2024-01-20" (ISO format if possible, or "tomorrow", "next tuesday"),
  "site_address": "Work location"
}

### Invoice Data (for create_invoice):
{
  "client_name": "Full Name",
  "items": [
    { "description": "Work description", "quantity": 1, "price": 100.00 }
  ],
  "total": 100.00,
  "due_date": "seven_days" (or specific date)
}

### Client Data (for create_client):
{
  "client_name": "Full Name",
  "client_phone": "04XXXXXXXX",
  "client_email": "email@example.com",
  "client_address": "Full Address"
}

### Search Data (for find_client):
{
  "search_name": "Name to find"
}

### Job Note Data (for add_job_note):
{
  "note": "The content of the note"
}

## Australian Speech Patterns to Understand
- Numbers: "forty five" = 45, "one fifty" = 150, "two hundred" = 200
- Phone: "zero four one two three four five six seven eight" = "0412345678"
- Slang: "dunny" = toilet, "tap" = faucet, "sparky" = electrician, "chippy" = carpenter
- Affirmations: "yeah", "yep", "nah", "reckon", "chuck it in"

## Conversation Flow Examples

### Quote Creation Flow:
User: "I need to make a quote"
→ {"speak": "No worries mate! Who's this quote for?", "action": "ask_details", "data": {}}

User: "Sarah Chen"  
→ {"speak": "Beauty! What work are you quoting for Sarah?", "action": "ask_details", "data": {"client_name": "Sarah Chen"}}

User: "Install six downlights at forty five each and two hours labour at one fifty per hour"
→ {"speak": "Got it! Six downlights at $45 and 2 hours labour at $150. That's $570 total. Want me to add anything else?", "action": "ask_details", "data": {"client_name": "Sarah Chen", "items": [{"description": "Install downlights", "quantity": 6, "price": 45}, {"description": "Labour", "quantity": 2, "price": 150}], "total": 570}}

User: "Nah that's all"
→ {"speak": "Done! Created a quote for Sarah - $570. Taking you there now.", "action": "create_quote", "data": {"client_name": "Sarah Chen", "items": [{"description": "Install downlights", "quantity": 6, "price": 45}, {"description": "Labour", "quantity": 2, "price": 150}], "total": 570}}

### Quick Commands:
User: "Create client Mike Ross 0400111222"
→ {"speak": "Easy, creating a new client for Mike.", "action": "create_client", "data": {"client_name": "Mike Ross", "client_phone": "0400111222"}}

User: "Schedule a job for tomorrow at 10 to fix the roof for Tom"
→ {"speak": "Done! Scheduled the roof fix for Tom tomorrow.", "action": "schedule_job", "data": {"title": "Fix the roof", "client_name": "Tom", "scheduled_date": "tomorrow", "description": "Fix the roof"}}

User: "Create invoice for BuildCorp for fencing $5000"
→ {"speak": "Sweet, generating invoice for BuildCorp.", "action": "create_invoice", "data": {"client_name": "BuildCorp", "total": 5000, "items": [{"description": "Fencing", "price": 5000, "quantity": 1}]}}

User: "Find John Smith"
→ {"speak": "Looking up John Smith for ya...", "action": "find_client", "data": {"search_name": "John Smith"}}

User: "Add a note: replaced the hot water system, old one had a major leak"
→ {"speak": "Noted! I've added that to the job record.", "action": "add_job_note", "data": {"note": "Replaced the hot water system, old one had a major leak"}}

User: "Schedule a job for tomorrow at Dave's place to fix the ceiling fan"
→ {"speak": "Done! Job scheduled for tomorrow at Dave's for the ceiling fan.", "action": "schedule_job", "data": {"client_name": "Dave", "title": "Fix ceiling fan", "scheduled_date": "tomorrow"}}

## Important Rules
1. ALWAYS maintain context from previous messages in the conversation
2. ALWAYS accumulate data - don't lose previous info when user adds more
3. Calculate totals correctly: quantity × price for each item, then sum
4. Add 10% GST for Australian quotes when calculating final total (optional, mention it)
5. If user says "that's it" or "done" or "send it" - finalize the action
6. If confused, ask for clarification politely
7. Never make up data - only use what user provides

Current timestamp: ${new Date().toISOString()}
`;

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { query, conversationHistory, accumulatedData } = body;

        if (!query || query.trim() === '') {
            return new Response(JSON.stringify({
                speak: "I didn't catch that, mate. Could you say it again?",
                action: "ask_details",
                data: accumulatedData || {}
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Build conversation messages
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        // Add conversation history if present
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory) {
                if (msg.role && msg.content) {
                    messages.push({ role: msg.role, content: msg.content });
                }
            }
        }

        // Add context about accumulated data so AI remembers
        if (accumulatedData && Object.keys(accumulatedData).length > 0) {
            messages.push({
                role: 'system',
                content: `CONTEXT: User has already provided this data in the conversation: ${JSON.stringify(accumulatedData)}. Build upon this, don't ask for info you already have.`
            });
        }

        // Add current user message
        messages.push({ role: 'user', content: query });

        // Call OpenRouter
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://tradiemate.app",
                "X-Title": "TradieMate Voice AI"
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter Error:", response.status, errorText);
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices?.[0]?.message?.content) {
            throw new Error("Invalid API response structure");
        }

        // Parse AI response
        let aiResponse;
        try {
            aiResponse = JSON.parse(data.choices[0].message.content);
        } catch (e) {
            // If JSON parsing fails, create a safe response
            aiResponse = {
                speak: "Sorry mate, I got a bit confused. Could you say that again?",
                action: "ask_details",
                data: accumulatedData || {}
            };
        }

        // Ensure response has required fields
        if (!aiResponse.speak) aiResponse.speak = "Got it!";
        if (!aiResponse.action) aiResponse.action = "general_reply";
        if (!aiResponse.data) aiResponse.data = {};

        // Merge accumulated data with new data from AI
        if (accumulatedData) {
            aiResponse.data = { ...accumulatedData, ...aiResponse.data };
        }

        return new Response(JSON.stringify(aiResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Voice AI Error:", error);

        return new Response(JSON.stringify({
            speak: "Sorry mate, I'm having a bit of trouble. Let's try that again.",
            action: "ask_details",
            data: {},
            error: String(error)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
