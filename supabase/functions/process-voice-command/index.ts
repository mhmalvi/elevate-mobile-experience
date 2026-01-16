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
You are TradieMate AI, a helpful assistant for tradespeople.
Your goal is to help them create quotes, invoices, or manage jobs via voice.
You must return a JSON response with the following structure:
{
  "speak": "Text to speak back to the user",
  "action": "ACTION_NAME",
  "data": { ...any extracted data... },
  "missing_fields": ["field1", "field2"] // if applicable
}

ACTIONS:
- "ask_details": If you need more info (e.g. client name, items).
- "create_quote": If you have Client Name and at least one Item.
- "create_invoice": If you have Client Name and Items.
- "general_reply": For general questions.

Current Date: ${new Date().toISOString()}

EXAMPLE INTERACTION:
User: "Create a quote"
Response: { "speak": "Sure, who is this quote for?", "action": "ask_details", "missing_fields": ["client_name"] }
User: "John Smith"
Response: { "speak": "What work are you doing for John?", "action": "ask_details", "data": { "client_name": "John Smith" }, "missing_fields": ["items"] }
User: "Fixing the sink for $150"
Response: { 
  "speak": "I've drafted a quote for John Smith to fix the sink. Taking you to it now.", 
  "action": "create_quote", 
  "data": { 
    "client_name": "John Smith", 
    "items": [{ "description": "Fixing the sink", "price": 150, "quantity": 1 }],
    "total": 150
  } 
}
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

        const data = await response.json();
        const aiResponse = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify(aiResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("AI Processing Error:", error);
        // Fallback for demo if API fails
        const fallback = {
            speak: "I'm having trouble connecting to my brain. Let me draft a blank quote for you.",
            action: "create_quote",
            data: { client_name: "Unknown Client", items: [] }
        };
        return new Response(JSON.stringify(fallback), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
