/**
 * FormField Component
 *
 * A wrapper component that displays validation errors for form inputs
 * Provides consistent error styling and accessibility
 */

import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  id: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  children?: ReactNode;
  helpText?: string;
}

export function FormField({
  label,
  id,
  error,
  touched,
  required,
  children,
  helpText,
}: FormFieldProps) {
  const showError = touched && error;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={showError ? 'text-destructive' : ''}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {children}

      {/* Help text */}
      {helpText && !showError && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}

      {/* Error message */}
      {showError && (
        <div
          className="flex items-start gap-2 text-sm text-destructive animate-fade-in"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface ValidatedInputProps {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
  autoComplete?: string;
}

/**
 * Validated Input Field
 * Combines FormField with Input for easy use
 */
export function ValidatedInput({
  label,
  id,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  touched,
  required,
  placeholder,
  helpText,
  disabled,
  autoComplete,
}: ValidatedInputProps) {
  const showError = touched && error;

  return (
    <FormField
      label={label}
      id={id}
      error={error}
      touched={touched}
      required={required}
      helpText={helpText}
    >
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={showError ? 'border-destructive focus-visible:ring-destructive' : ''}
        aria-invalid={showError}
        aria-describedby={showError ? `${id}-error` : undefined}
      />
    </FormField>
  );
}

interface ValidatedTextareaProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  rows?: number;
  disabled?: boolean;
}

/**
 * Validated Textarea Field
 * Combines FormField with Textarea for easy use
 */
export function ValidatedTextarea({
  label,
  id,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required,
  placeholder,
  helpText,
  rows = 3,
  disabled,
}: ValidatedTextareaProps) {
  const showError = touched && error;

  return (
    <FormField
      label={label}
      id={id}
      error={error}
      touched={touched}
      required={required}
      helpText={helpText}
    >
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={showError ? 'border-destructive focus-visible:ring-destructive' : ''}
        aria-invalid={showError}
        aria-describedby={showError ? `${id}-error` : undefined}
      />
    </FormField>
  );
}
