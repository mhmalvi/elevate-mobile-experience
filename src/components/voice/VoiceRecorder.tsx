import { Mic, MicOff, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { VoiceStatus } from './types';

interface VoiceRecorderProps {
  status: VoiceStatus;
  transcript: string;
  fullTranscript: string;
  startRecording: () => void;
  stopRecording: () => void;
  sendMessage: () => void;
}

/**
 * Renders the bottom control bar: mic button (idle), cancel/send (listening),
 * or a spinner (processing/speaking).
 */
export function VoiceRecorder({
  status,
  transcript,
  fullTranscript,
  startRecording,
  stopRecording,
  sendMessage,
}: VoiceRecorderProps) {
  if (status === 'listening') {
    return (
      <>
        <Button
          variant="outline"
          size="lg"
          onClick={stopRecording}
          className="rounded-full h-16 px-8 gap-2 border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
        >
          <MicOff className="w-5 h-5" />
          Cancel
        </Button>

        <Button
          size="lg"
          onClick={sendMessage}
          disabled={!transcript && !fullTranscript}
          className="rounded-full h-16 w-16 p-0 bg-primary shadow-lg shadow-primary/25 hover:scale-110 transition-transform hover:shadow-xl"
        >
          <Send className="w-6 h-6 ml-0.5" />
        </Button>
      </>
    );
  }

  if (status === 'processing' || status === 'speaking') {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
        <div className="h-16 w-16 rounded-full border-2 border-primary/20 border-t-primary flex items-center justify-center animate-spin">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      onClick={startRecording}
      className={cn(
        'rounded-full h-24 w-24 p-0 shadow-2xl transition-all duration-300 group relative',
        'bg-gradient-to-b from-primary to-primary/90 hover:scale-105 active:scale-95',
        'border-[6px] border-background ring-1 ring-border'
      )}
    >
      <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-0 group-hover:opacity-20" />
      <Mic className="w-10 h-10 text-primary-foreground drop-shadow-md" />
    </Button>
  );
}
