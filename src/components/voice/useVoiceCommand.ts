import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { VoiceStatus, ConversationMessage, VoiceEntityData } from './types';
import { MAX_RECORD_TIME } from './types';
import { processVoiceCommand, AuthRequiredError } from './VoiceProcessor';
import { dispatchAction } from './VoiceActionDispatch';

/** Voice selection for text-to-speech */
const getPreferredVoice = (): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const priority = ['Karen', 'Catherine', 'Tessa', 'Moira', 'Samantha', 'Victoria'];

  for (const name of priority) {
    const found = voices.find((v) => v.name.includes(name));
    if (found) return found;
  }

  return (
    voices.find((v) => v.lang.includes('en-AU')) ||
    voices.find((v) => v.lang.includes('en-GB') && v.name.toLowerCase().includes('female')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  );
};

export function useVoiceCommand() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Core State
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);

  // Conversation Context
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [accumulatedData, setAccumulatedData] = useState<VoiceEntityData>({});

  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechRef = useRef<number>(0);
  const hasSpeechRef = useRef<boolean>(false);
  const sendMessageRef = useRef<(() => void) | null>(null);
  const speakTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cleanupRef = useRef<() => void>(() => {});
  const resetConversationRef = useRef<() => void>(() => {});
  const speakRef = useRef<(text: string, autoListen: boolean) => void>(() => {});

  // Load voices
  useEffect(() => {
    const loadVoices = () => setSelectedVoice(getPreferredVoice());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Handle sheet open/close
  useEffect(() => {
    if (open) {
      resetConversationRef.current();
      setAiMessage("Hey! What can I help you with today?");
      const t = setTimeout(() => speakRef.current("Hey! What can I help you with?", false), 500);
      speakTimerRefs.current.push(t);
    } else {
      cleanupRef.current();
    }
  }, [open]);

  // Recording timer
  useEffect(() => {
    if (status === 'listening') {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORD_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const cleanup = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    speakTimerRefs.current.forEach(clearTimeout);
    speakTimerRefs.current = [];
    window.speechSynthesis.cancel();
  };

  const resetConversation = () => {
    setStatus('idle');
    setTranscript('');
    setFullTranscript('');
    setConversationHistory([]);
    setAccumulatedData({});
    setRecordingTime(0);
  };

  const speak = (text: string, autoListen: boolean) => {
    window.speechSynthesis.cancel();

    if (!('speechSynthesis' in window) || !text) {
      if (autoListen && open) {
        const t = setTimeout(() => startRecording(), 500);
        speakTimerRefs.current.push(t);
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    if (selectedVoice) utterance.voice = selectedVoice;

    let ended = false;
    const onComplete = () => {
      if (ended) return;
      ended = true;
      if (autoListen && open) {
        setStatus('idle');
        const t = setTimeout(() => startRecording(), 500);
        speakTimerRefs.current.push(t);
      } else {
        setStatus('idle');
      }
    };

    utterance.onstart = () => setStatus('speaking');
    utterance.onend = onComplete;
    utterance.onerror = onComplete;

    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = Math.max(1500, wordCount * 400 + 500);
    const fallbackTimer = setTimeout(onComplete, estimatedDuration);
    speakTimerRefs.current.push(fallbackTimer);

    window.speechSynthesis.speak(utterance);
  };

  const startRecording = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast({
        title: 'Voice not supported',
        description: 'Use Chrome or Safari',
        variant: 'destructive',
      });
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';
    recognition.maxAlternatives = 1;

    hasSpeechRef.current = false;
    lastSpeechRef.current = 0;
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);

    recognition.onstart = () => {
      setStatus('listening');
      setTranscript('');

      silenceTimerRef.current = setInterval(() => {
        if (hasSpeechRef.current && lastSpeechRef.current > 0) {
          const silenceDuration = Date.now() - lastSpeechRef.current;
          if (silenceDuration > 3000) {
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
            sendMessageRef.current?.();
          }
        }
      }, 500);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      lastSpeechRef.current = Date.now();
      if (interim || final) hasSpeechRef.current = true;

      setTranscript(interim);
      if (final) {
        setFullTranscript((prev) => prev + final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setStatus('error');
        setAiMessage('Voice input error. Please try again.');
      }
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setStatus('idle');
  }, []);

  const speakThenDo = (text: string, fn: () => void) => {
    speak(text, false);
    const t = setTimeout(fn, 1500);
    speakTimerRefs.current.push(t);
  };

  const onToast = (opts: { title: string; description?: string; variant?: 'destructive' | 'default' }) => {
    toast(opts);
  };

  const sendMessage = useCallback(
    async (directText?: string | unknown) => {
      const messageText =
        (typeof directText === 'string' ? directText : '') || (fullTranscript + transcript).trim();

      if (!messageText) {
        setAiMessage("I didn't hear anything. Please try again.");
        return;
      }

      stopRecording();
      setStatus('processing');
      setAiMessage('Processing...');
      setTranscript('');
      setFullTranscript('');

      try {
        const { response, action, responseData } = await processVoiceCommand({
          messageText,
          conversationHistory,
          accumulatedData,
        });

        setConversationHistory((prev) => [
          ...prev,
          { role: 'user', content: messageText },
          { role: 'assistant', content: response },
        ]);

        if (responseData) {
          setAccumulatedData((prev) => ({ ...prev, ...responseData }));
        }

        setAiMessage(response);

        const mergedData: VoiceEntityData = { ...accumulatedData, ...responseData };

        await dispatchAction(action, mergedData, response, {
          userId: user?.id || '',
          setStatus,
          setAiMessage,
          setOpen,
          speak,
          speakThenDo,
          navigate,
          onToast,
        });
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          setStatus('error');
          setAiMessage(err.message);
          speak('You need to be logged in to use voice commands.', false);
        } else {
          console.error('Voice AI error:', err);
          setStatus('error');
          setAiMessage("Something went wrong. Let's try again.");
          speak('Sorry, I had trouble with that. Could you try again?', true);
        }
      }
    },
    [fullTranscript, transcript, conversationHistory, accumulatedData, stopRecording]
  );

  // Keep sendMessageRef current for silence auto-send
  useEffect(() => {
    sendMessageRef.current = () => sendMessage();
  }, [sendMessage]);

  // Keep function refs current to avoid stale closures in useEffect
  cleanupRef.current = cleanup;
  resetConversationRef.current = resetConversation;
  speakRef.current = speak;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return {
    // Sheet state
    open,
    setOpen,

    // Voice state
    status,
    transcript,
    fullTranscript,
    aiMessage,
    recordingTime,
    conversationHistory,

    // Actions
    startRecording,
    stopRecording,
    sendMessage,
    formatTime,
  };
}
