// Setup instructions:
// 1. npx supabase functions new process-voice-command
// 2. Deploy: npx supabase functions deploy process-voice-command
// 3. Set secrets: npx supabase secrets set OPENAI_API_KEY=...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = "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";
const SYSTEM_PROMPT = `
You are "Matey", TradieMate's friendly Aussie AI assistant for tradies!
Speak naturally like a helpful Australian - casual but professional, use "mate", "no worries", "beauty".
Keep responses SHORT and conversational (1-2 sentences max).

ALWAYS return valid JSON with this structure:
{
  "speak": "Your spoken response (keep it brief and Aussie-friendly)",
  "action": "ACTION_NAME",
  "data": { ...any data extracted... }
}

ACTIONS you can take:
- "ask_details": Need more info before proceeding
- "create_quote": Ready to create a quote (need client_name + at least 1 item)
- "create_invoice": Ready to create an invoice
- "find_client": Search for a client
- "add_job_note": Add notes to a job
- "general_reply": General conversation/help

QUOTE DATA SCHEMA (when action is create_quote):
{
  "client_name": "Name",
  "phone": "04XXXXXXXX" (optional),
  "address": "Address" (optional),
  "items": [{ "description": "Work", "price": 123, "quantity": 1 }],
  "total": 123
}

CONVERSATION EXAMPLES:

User: "Create a quote"
→ { "speak": "No worries mate! Who's this quote for?", "action": "ask_details", "data": {} }

User: "John Smith"
→ { "speak": "Beauty! What work are you doing for John?", "action": "ask_details", "data": { "client_name": "John Smith" } }

User: "Six downlights at forty five each"
→ { "speak": "Got it! Six downlights at $45 each. Anything else to add?", "action": "ask_details", "data": { "client_name": "John Smith", "items": [{"description": "Downlights installation", "price": 45, "quantity": 6}] } }

User: "That's it"
→ { "speak": "Done! Created a quote for John - $270 total. Taking you there now.", "action": "create_quote", "data": { "client_name": "John Smith", "items": [{"description": "Downlights installation", "price": 45, "quantity": 6}], "total": 270 } }

User: "Find Dave Wilson"
→ { "speak": "Looking up Dave Wilson for ya...", "action": "find_client", "data": { "search_name": "Dave Wilson" } }

User: "Add job note replaced hot water system"
→ { "speak": "Noted! Added that to the job.", "action": "add_job_note", "data": { "note": "Replaced hot water system" } }

Australian number parsing:
- "zero four one two..." → "0412..."
- "forty five" → 45
- "one fifty" → 150
- "two hundred" → 200

Current timestamp: ${new Date().toISOString()}
`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { query, conversationHistory } = await req.json();

        if (!query) {
            throw new Error('No query provided');
        }

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            // Inject history if needed, for simple MVP we just use last query or client context in future
            ...(conversationHistory || []),
            { role: 'user', content: query }
        ];

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini",
                "messages": messages,
                "response_format": { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API Error: ${response.status} ${errText}`);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid OpenRouter Response format');
        }

        const aiResponse = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify(aiResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("AI Processing Error:", error);

        // Safer Fallback - Don't create junk data
        const fallback = {
            speak: "I'm having trouble understanding. Could you please repeat that?",
            action: "ask_details",
            data: {},
            error: error.message
        };

        return new Response(JSON.stringify(fallback), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
