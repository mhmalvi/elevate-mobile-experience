/**
 * Form Validation Hook
 *
 * Provides real-time form validation with error messages
 * Use this hook to validate forms as users type
 */

import { useState, useCallback } from 'react';
import { ValidationResult } from '@/lib/validation';

export interface FieldValidation {
  validate: (value: any) => ValidationResult;
  required?: boolean;
}

export interface FormValidationConfig {
  [fieldName: string]: FieldValidation;
}

export interface FormErrors {
  [fieldName: string]: string | undefined;
}

export interface FormTouched {
  [fieldName: string]: boolean;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationConfig: FormValidationConfig
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    (fieldName: string, value: any): string | undefined => {
      const config = validationConfig[fieldName];

      if (!config) {
        return undefined;
      }

      // Check if field is required but empty
      if (config.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return `${fieldName} is required`;
      }

      // Skip validation if field is not required and empty
      if (!config.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return undefined;
      }

      // Run custom validation
      const result = config.validate(value);

      return result.valid ? undefined : result.error;
    },
    [validationConfig]
  );

  /**
   * Validate all fields
   */
  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(validationConfig).forEach((fieldName) => {
      const error = validateField(fieldName, values[fieldName]);

      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);

    // Mark all fields as touched
    const allTouched: FormTouched = {};
    Object.keys(validationConfig).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    return isValid;
  }, [validationConfig, values, validateField]);

  /**
   * Handle field change with validation
   */
  const handleChange = useCallback(
    (fieldName: string, value: any) => {
      // Update value
      setValues((prev) => ({
        ...prev,
        [fieldName]: value,
      }));

      // Validate if field has been touched
      if (touched[fieldName]) {
        const error = validateField(fieldName, value);
        setErrors((prev) => ({
          ...prev,
          [fieldName]: error,
        }));
      }
    },
    [touched, validateField]
  );

  /**
   * Handle field blur (mark as touched and validate)
   */
  const handleBlur = useCallback(
    (fieldName: string) => {
      // Mark field as touched
      setTouched((prev) => ({
        ...prev,
        [fieldName]: true,
      }));

      // Validate field
      const error = validateField(fieldName, values[fieldName]);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    },
    [values, validateField]
  );

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  /**
   * Set form values programmatically
   */
  const setFormValues = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({
      ...prev,
      ...newValues,
    }));
  }, []);

  /**
   * Check if form has any errors
   */
  const hasErrors = Object.keys(errors).some((key) => errors[key] !== undefined);

  /**
   * Check if form is valid (no errors and all required fields filled)
   */
  const isValid = !hasErrors && Object.keys(validationConfig).every((key) => {
    const config = validationConfig[key];
    const value = values[key];

    if (config.required) {
      return value !== undefined && value !== null && value !== '';
    }

    return true;
  });

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    setFormValues,
    hasErrors,
    isValid,
  };
}
