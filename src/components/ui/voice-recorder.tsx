import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
    onSave: (audioBlob: Blob, duration: number) => Promise<void>;
    className?: string;
}

export function VoiceRecorder({ onSave, className }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [saving, setSaving] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(100);
            setIsRecording(true);
            setDuration(0);

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current || !audioUrl) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSave = async () => {
        if (!audioBlob) return;
        setSaving(true);
        try {
            await onSave(audioBlob, duration);
            discardRecording();
        } catch (error) {
            console.error('Error saving voice note:', error);
        } finally {
            setSaving(false);
        }
    };

    const discardRecording = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(null);
        setAudioUrl(null);
        setDuration(0);
        setIsPlaying(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={cn("p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4", className)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Voice Note</span>
                </div>
                {(isRecording || audioBlob) && (
                    <span className={cn(
                        "text-sm font-mono font-bold",
                        isRecording && "text-destructive animate-pulse"
                    )}>
                        {formatTime(duration)}
                    </span>
                )}
            </div>

            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                />
            )}

            <div className="flex items-center gap-2">
                {!audioBlob ? (
                    <Button
                        type="button"
                        variant={isRecording ? "destructive" : "default"}
                        onClick={isRecording ? stopRecording : startRecording}
                        className="flex-1 h-12 rounded-xl gap-2"
                    >
                        {isRecording ? (
                            <>
                                <Square className="w-4 h-4" />
                                Stop Recording
                            </>
                        ) : (
                            <>
                                <Mic className="w-4 h-4" />
                                Start Recording
                            </>
                        )}
                    </Button>
                ) : (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={togglePlayback}
                            className="h-12 w-12 rounded-xl shrink-0"
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={discardRecording}
                            className="h-12 w-12 rounded-xl shrink-0 text-destructive hover:text-destructive"
                        >
                            <Trash2 className="w-5 h-5" />
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 h-12 rounded-xl"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Voice Note'
                            )}
                        </Button>
                    </>
                )}
            </div>

            {!audioBlob && !isRecording && (
                <p className="text-xs text-muted-foreground text-center">
                    Tap to record a voice note for this job
                </p>
            )}
        </div>
    );
}
