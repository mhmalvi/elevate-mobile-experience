import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerProps {
  initialSeconds?: number;
  onTimeUpdate?: (seconds: number) => void;
  className?: string;
}

export function Timer({ initialSeconds = 0, onTimeUpdate, className }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          const newSeconds = prev + 1;
          onTimeUpdate?.(newSeconds);
          return newSeconds;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onTimeUpdate]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setSeconds(0);
    onTimeUpdate?.(0);
  };

  return (
    <div className={cn("p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Time Tracker</span>
      </div>
      
      <div className={cn(
        "text-4xl font-mono font-bold text-center py-4 rounded-lg mb-4 transition-colors",
        isRunning ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
      )}>
        {formatTime(seconds)}
      </div>

      <div className="flex gap-2">
        {!isRunning ? (
          <Button onClick={handleStart} className="flex-1 h-12 shadow-premium">
            <Play className="w-5 h-5 mr-2" />
            Start
          </Button>
        ) : (
          <Button onClick={handlePause} variant="outline" className="flex-1 h-12">
            <Pause className="w-5 h-5 mr-2" />
            Pause
          </Button>
        )}
        <Button 
          onClick={handleReset} 
          variant="ghost" 
          className="h-12 px-4"
          disabled={seconds === 0}
        >
          <Square className="w-5 h-5" />
        </Button>
      </div>

      {seconds > 0 && (
        <p className="text-center text-sm text-muted-foreground mt-3">
          {(seconds / 3600).toFixed(2)} hours tracked
        </p>
      )}
    </div>
  );
}
