import { supabase } from '@/integrations/supabase/client';
import type { ConversationMessage, VoiceCommandResponse, VoiceEntityData } from './types';

interface ProcessVoiceCommandParams {
  messageText: string;
  conversationHistory: ConversationMessage[];
  accumulatedData: VoiceEntityData;
}

interface ProcessVoiceCommandResult {
  response: string;
  action: string;
  responseData: VoiceEntityData;
}

/**
 * Calls the process-voice-command edge function with the user's message
 * and conversation context. Returns the AI response, action, and extracted data.
 */
export async function processVoiceCommand({
  messageText,
  conversationHistory,
  accumulatedData,
}: ProcessVoiceCommandParams): Promise<ProcessVoiceCommandResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || null;

  if (!accessToken) {
    throw new AuthRequiredError('Please log in to use voice commands.');
  }

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-voice-command`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        query: messageText,
        conversationHistory,
        accumulatedData,
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error || `Voice command failed (${res.status})`);
  }

  const data = (await res.json()) as VoiceCommandResponse;

  return {
    response: data.speak,
    action: data.action,
    responseData: data.data || {},
  };
}

export class AuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRequiredError';
  }
}
