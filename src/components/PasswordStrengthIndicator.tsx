import { useEffect, useState } from 'react';
import { checkPasswordStrength, getPasswordStrengthLabel, getPasswordStrengthColor } from '@/lib/passwordSecurity';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  showFeedback = true,
  className
}: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState(checkPasswordStrength(''));

  useEffect(() => {
    if (password) {
      setStrength(checkPasswordStrength(password));
    } else {
      setStrength(checkPasswordStrength(''));
    }
  }, [password]);

  if (!password) {
    return null;
  }

  const strengthLabel = getPasswordStrengthLabel(strength.score);
  const strengthColor = getPasswordStrengthColor(strength.score);
  const progressValue = (strength.score / 4) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Password Strength:</span>
        <span
          className="font-medium"
          style={{ color: strengthColor }}
        >
          {strengthLabel}
        </span>
      </div>

      <Progress
        value={progressValue}
        className="h-2"
        style={{
          '--progress-background': strengthColor,
        } as React.CSSProperties}
      />

      {showFeedback && strength.feedback.length > 0 && (
        <div className="space-y-1">
          {strength.feedback.map((feedback, index) => (
            <p
              key={index}
              className={cn(
                "text-xs",
                strength.isCommon ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              {feedback}
            </p>
          ))}
        </div>
      )}

      {strength.isCommon && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <span className="text-destructive text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Common Password Detected
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              This password appears in lists of commonly used passwords and could be easily guessed.
              Please choose a more unique password for better security.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
