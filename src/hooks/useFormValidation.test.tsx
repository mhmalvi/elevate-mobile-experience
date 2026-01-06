import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation, FormValidationConfig } from './useFormValidation';
import { validateEmail, validateAustralianPhone, validatePostcode } from '@/lib/validation';

describe('Form Validation Hook - useFormValidation', () => {
  describe('Basic Form Validation', () => {
    it('should initialize with default values', () => {
      const initialValues = {
        name: '',
        email: '',
        phone: '',
      };

      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: false },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.isValid).toBe(false); // Required fields are empty
    });

    it('should mark field as touched on blur', () => {
      const initialValues = { email: '' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.touched.email).toBe(true);
    });

    it('should validate field on blur', () => {
      const initialValues = { email: 'invalid-email' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBeDefined();
      expect(result.current.errors.email).toContain('valid email');
    });
  });

  describe('Required Field Validation', () => {
    it('should show error for required empty field', () => {
      const initialValues = { name: '' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.errors.name).toBe('name is required');
      expect(result.current.isValid).toBe(false);
    });

    it('should not show error for optional empty field', () => {
      const initialValues = { notes: '' };
      const config: FormValidationConfig = {
        notes: { validate: () => ({ valid: true }), required: false },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.errors.notes).toBeUndefined();
      expect(result.current.isValid).toBe(true);
    });

    it('should treat whitespace-only as empty', () => {
      const initialValues = { name: '   ' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.errors.name).toBe('name is required');
    });
  });

  describe('Field Change Handling', () => {
    it('should update field value on change', () => {
      const initialValues = { email: '' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });

      expect(result.current.values.email).toBe('test@example.com');
    });

    it('should validate on change only if field was touched', () => {
      const initialValues = { email: '' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      // Change without touching - should not validate
      act(() => {
        result.current.handleChange('email', 'invalid-email');
      });
      expect(result.current.errors.email).toBeUndefined();

      // Touch the field
      act(() => {
        result.current.handleBlur('email');
      });
      expect(result.current.errors.email).toBeDefined();

      // Now changes should trigger validation
      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });
      expect(result.current.errors.email).toBeUndefined();
    });

    it('should handle multiple field changes', () => {
      const initialValues = { name: '', email: '', phone: '' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: false },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleChange('name', 'John Smith');
        result.current.handleChange('email', 'john@example.com');
        result.current.handleChange('phone', '0412345678');
      });

      expect(result.current.values.name).toBe('John Smith');
      expect(result.current.values.email).toBe('john@example.com');
      expect(result.current.values.phone).toBe('0412345678');
    });
  });

  describe('Email Validation Integration', () => {
    it('should validate correct email addresses', () => {
      const initialValues = { email: '' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleBlur('email');
      });

      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });

      expect(result.current.errors.email).toBeUndefined();
    });

    it('should reject invalid email addresses', () => {
      const initialValues = { email: '' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleChange('email', 'invalid-email');
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBeDefined();
      expect(result.current.isValid).toBe(false);
    });
  });

  describe('Phone Validation Integration', () => {
    it('should validate Australian mobile numbers', () => {
      const initialValues = { phone: '' };
      const config: FormValidationConfig = {
        phone: { validate: validateAustralianPhone, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleBlur('phone');
      });

      act(() => {
        result.current.handleChange('phone', '0412345678');
      });

      expect(result.current.errors.phone).toBeUndefined();
    });

    it('should reject invalid phone numbers', () => {
      const initialValues = { phone: '' };
      const config: FormValidationConfig = {
        phone: { validate: validateAustralianPhone, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleChange('phone', '123456');
        result.current.handleBlur('phone');
      });

      expect(result.current.errors.phone).toBeDefined();
    });
  });

  describe('Postcode Validation Integration', () => {
    it('should validate Australian postcodes', () => {
      const initialValues = { postcode: '' };
      const config: FormValidationConfig = {
        postcode: { validate: validatePostcode, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleBlur('postcode');
      });

      act(() => {
        result.current.handleChange('postcode', '2000');
      });

      expect(result.current.errors.postcode).toBeUndefined();
    });

    it('should reject invalid postcodes', () => {
      const initialValues = { postcode: '' };
      const config: FormValidationConfig = {
        postcode: { validate: validatePostcode, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.handleChange('postcode', '123');
        result.current.handleBlur('postcode');
      });

      expect(result.current.errors.postcode).toBeDefined();
    });
  });

  describe('validateAll Function', () => {
    it('should validate all fields at once', () => {
      const initialValues = {
        name: 'John Smith',
        email: 'invalid-email',
        phone: '123',
      };

      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      let isValid: boolean = false;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid).toBe(false);
      expect(result.current.errors.email).toBeDefined();
      expect(result.current.errors.phone).toBeDefined();
      expect(result.current.errors.name).toBeUndefined();
    });

    it('should mark all fields as touched after validateAll', () => {
      const initialValues = { name: '', email: '', phone: '' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: false },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.touched.name).toBe(true);
      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.phone).toBe(true);
    });

    it('should return true when all fields are valid', () => {
      const initialValues = {
        name: 'John Smith',
        email: 'john@example.com',
        phone: '0412345678',
      };

      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      let isValid: boolean = false;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid).toBe(true);
      expect(Object.keys(result.current.errors).length).toBe(0);
    });
  });

  describe('Form Reset', () => {
    it('should reset form to initial values', () => {
      const initialValues = { name: '', email: '' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      // Make changes
      act(() => {
        result.current.handleChange('name', 'John Smith');
        result.current.handleChange('email', 'john@example.com');
        result.current.handleBlur('name');
        result.current.handleBlur('email');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
    });
  });

  describe('setFormValues Function', () => {
    it('should set form values programmatically', () => {
      const initialValues = { name: '', email: '', phone: '' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: false },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.setFormValues({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });
      });

      expect(result.current.values.name).toBe('Jane Doe');
      expect(result.current.values.email).toBe('jane@example.com');
      expect(result.current.values.phone).toBe(''); // Unchanged
    });

    it('should partially update form values', () => {
      const initialValues = { name: 'John', email: 'john@example.com' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      act(() => {
        result.current.setFormValues({ name: 'Jane' });
      });

      expect(result.current.values.name).toBe('Jane');
      expect(result.current.values.email).toBe('john@example.com'); // Unchanged
    });
  });

  describe('isValid and hasErrors Properties', () => {
    it('should correctly report hasErrors', () => {
      const initialValues = { email: 'invalid-email' };
      const config: FormValidationConfig = {
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      // No errors initially (not validated yet)
      expect(result.current.hasErrors).toBe(false);

      // Trigger validation
      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.hasErrors).toBe(true);
    });

    it('should correctly report isValid', () => {
      const initialValues = { name: '', email: '' };
      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      // Invalid initially (required fields empty)
      expect(result.current.isValid).toBe(false);

      // Fill in valid data
      act(() => {
        result.current.handleChange('name', 'John Smith');
        result.current.handleChange('email', 'john@example.com');
      });

      expect(result.current.isValid).toBe(true);
    });
  });

  describe('Complex Form Scenarios', () => {
    it('should handle client form validation', () => {
      const initialValues = {
        name: '',
        email: '',
        phone: '',
        postcode: '',
      };

      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: false },
        phone: { validate: validateAustralianPhone, required: false },
        postcode: { validate: validatePostcode, required: false },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      // Only name is required, should be invalid initially
      expect(result.current.isValid).toBe(false);

      // Add name
      act(() => {
        result.current.handleChange('name', 'John Smith');
      });

      expect(result.current.isValid).toBe(true);

      // Add invalid email - blur first to mark as touched
      act(() => {
        result.current.handleBlur('email');
      });

      act(() => {
        result.current.handleChange('email', 'invalid');
      });

      expect(result.current.hasErrors).toBe(true);
      expect(result.current.isValid).toBe(false);

      // Fix email
      act(() => {
        result.current.handleChange('email', 'john@example.com');
      });

      expect(result.current.hasErrors).toBe(false);
      expect(result.current.isValid).toBe(true);
    });

    it('should handle form with all valid data', () => {
      const initialValues = {
        name: 'John Smith',
        email: 'john@example.com',
        phone: '0412345678',
        postcode: '2000',
      };

      const config: FormValidationConfig = {
        name: { validate: () => ({ valid: true }), required: true },
        email: { validate: validateEmail, required: true },
        phone: { validate: validateAustralianPhone, required: true },
        postcode: { validate: validatePostcode, required: true },
      };

      const { result } = renderHook(() => useFormValidation(initialValues, config));

      let isValid: boolean = false;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid).toBe(true);
      expect(result.current.hasErrors).toBe(false);
      expect(result.current.isValid).toBe(true);
    });
  });
});
