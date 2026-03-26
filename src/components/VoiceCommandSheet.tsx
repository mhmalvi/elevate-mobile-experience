import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Mic, Loader2, Volume2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceCommand, VoiceRecorder } from '@/components/voice';
import type { VoiceCommandSheetProps } from '@/components/voice';

export function VoiceCommandSheet({ children }: VoiceCommandSheetProps) {
    const {
        open,
        setOpen,
        status,
        transcript,
        fullTranscript,
        aiMessage,
        recordingTime,
        conversationHistory,
        startRecording,
        stopRecording,
        sendMessage,
        formatTime,
    } = useVoiceCommand();

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>{children}</SheetTrigger>
            <SheetContent
                side="bottom"
                className="rounded-t-[2rem] border-t-0 bg-gradient-to-b from-background to-background/95 backdrop-blur-2xl h-[75vh] flex flex-col p-0 overflow-hidden"
            >
                {/* Hidden accessibility */}
                <SheetHeader className="sr-only">
                    <SheetTitle>Voice Assistant</SheetTitle>
                    <SheetDescription>AI Voice Assistant</SheetDescription>
                </SheetHeader>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg",
                            status === 'listening' ? "bg-red-500/20 ring-2 ring-red-500/50 scale-110" :
                                status === 'processing' ? "bg-blue-500/20 ring-2 ring-blue-500/50 animate-pulse" :
                                    status === 'speaking' ? "bg-green-500/20 ring-2 ring-green-500/50" :
                                        "bg-primary/10 ring-1 ring-primary/30"
                        )}>
                            {status === 'listening' ? <Mic className="w-6 h-6 text-red-500 animate-pulse" /> :
                                status === 'processing' ? <Loader2 className="w-6 h-6 text-blue-500 animate-spin" /> :
                                    status === 'speaking' ? <Volume2 className="w-6 h-6 text-green-500 animate-bounce" /> :
                                        <Sparkles className="w-6 h-6 text-primary" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-foreground tracking-tight">Voice Assistant</h3>
                            <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                                {status === 'listening' ? `Listening (${formatTime(recordingTime)})` :
                                    status === 'processing' ? 'Thinking...' :
                                        status === 'speaking' ? 'Speaking...' :
                                            'Your Helping Hand'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gradient-to-b from-transparent to-background/50">
                    {/* AI Message - Left Side */}
                    <div className="flex gap-4 animate-in slide-in-from-left-5 duration-500">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-md transform translate-y-2">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className={cn(
                            "flex-1 p-5 rounded-2xl rounded-tl-none shadow-sm backdrop-blur-sm transition-all duration-300",
                            status === 'success' ? "bg-green-500/10 border border-green-500/30" :
                                status === 'error' ? "bg-red-500/10 border border-red-500/30" :
                                    "bg-card/80 border border-border/50"
                        )}>
                            <p className={cn(
                                "text-lg leading-relaxed font-medium",
                                status === 'success' ? "text-green-700 dark:text-green-300" :
                                    status === 'error' ? "text-red-700 dark:text-red-300" :
                                        "text-foreground"
                            )}>
                                {aiMessage || "Hey! Need a hand with a quote, invoice, or job today?"}
                            </p>
                        </div>
                    </div>

                    {/* User Transcript - Right Side */}
                    {(transcript || fullTranscript) && (
                        <div className="flex gap-4 justify-end animate-in slide-in-from-right-5 duration-300">
                            <div className="flex-1 max-w-[85%] p-5 rounded-2xl rounded-tr-none bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md">
                                <p className="text-lg leading-relaxed">
                                    {fullTranscript}<span className="opacity-70 animate-pulse">{transcript}</span>
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 shadow-sm border border-border transform translate-y-2">
                                <div className="w-5 h-5 rounded-full bg-foreground/20" />
                            </div>
                        </div>
                    )}

                    {/* Quick Suggestions (when idle) */}
                    {status === 'idle' && !transcript && !fullTranscript && conversationHistory.length === 0 && (
                        <div className="space-y-6 pt-8 animate-in fade-in duration-700 delay-200">
                            <p className="text-sm font-medium text-muted-foreground text-center uppercase tracking-widest opacity-70">
                                I can help you with
                            </p>
                            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                                {[
                                    { label: "Create a new quote", command: "Create a new quote" },
                                    { label: "Add a client", command: "Add a new client" },
                                    { label: "Search for a client", command: "Find client" },
                                    { label: "New Invoice", command: "Create a new invoice" },
                                ].map((hint) => (
                                    <button
                                        key={hint.label}
                                        onClick={() => sendMessage(hint.command)}
                                        className="px-4 py-3 text-sm font-medium bg-card/50 hover:bg-primary/5 border border-border/50 hover:border-primary/30 rounded-xl transition-all hover:scale-105 hover:shadow-sm text-center"
                                    >
                                        {hint.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="border-t border-border/10 bg-background/60 backdrop-blur-xl px-6 py-8 pb-10">
                    <div className="flex items-center justify-center gap-6">
                        <VoiceRecorder
                            status={status}
                            transcript={transcript}
                            fullTranscript={fullTranscript}
                            startRecording={startRecording}
                            stopRecording={stopRecording}
                            sendMessage={() => sendMessage()}
                        />
                    </div>

                    {/* Helper Text */}
                    <p className="text-center text-xs font-medium text-muted-foreground/70 mt-6 tracking-wide">
                        {status === 'listening'
                            ? "Speak naturally. I'll send automatically when you pause."
                            : "Tap the mic to start speaking"}
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
