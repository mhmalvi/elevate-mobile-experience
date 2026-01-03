-- Migration: Encrypt Bank Account Details
-- Date: 2026-01-03
-- Purpose: Add encrypted columns for bank account information (Australian Banking Standards compliance)

-- Add encrypted bank account columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bank_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS bank_bsb_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name_encrypted TEXT;

-- Create comment explaining the security requirement
COMMENT ON COLUMN profiles.bank_name_encrypted IS 'Encrypted bank name (AES-GCM) - ABA compliance';
COMMENT ON COLUMN profiles.bank_bsb_encrypted IS 'Encrypted BSB number (AES-GCM) - ABA compliance';
COMMENT ON COLUMN profiles.bank_account_number_encrypted IS 'Encrypted account number (AES-GCM) - ABA compliance';
COMMENT ON COLUMN profiles.bank_account_name_encrypted IS 'Encrypted account holder name (AES-GCM) - ABA compliance';

-- Note: Old plaintext columns (bank_name, bank_bsb, bank_account_number, bank_account_name) will be deprecated
-- They are kept for backward compatibility during migration period
-- TODO: After full migration, remove plaintext columns in a future migration

-- Add index for faster lookups (encrypted columns don't need indexing as they won't be queried directly)
-- The user_id index already exists, which is sufficient for profile lookups
