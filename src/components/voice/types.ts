export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'success' | 'error';

export interface VoiceCommandSheetProps {
  children: React.ReactNode;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VoiceCommandResponse {
  speak: string;
  action: string;
  data: Record<string, unknown>;
}

export interface LineItem {
  description?: string;
  quantity?: number;
  price?: number;
}

export interface VoiceEntityData {
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  total?: number;
  notes?: string;
  items?: LineItem[];
  title?: string;
  description?: string;
  scheduled_date?: string;
  site_address?: string;
  search_name?: string;
  name?: string;
  invoice_number?: string;
  invoice_id?: string;
  job_id?: string;
  job_title?: string;
  entity_type?: string;
  entity_id?: string;
  new_status?: string;
  destination?: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export const MAX_RECORD_TIME = 120; // 2 minutes max
