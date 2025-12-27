-- Setup cron job to run recurring invoice generation daily at 6 AM UTC
-- This needs to be run in the Supabase SQL Editor

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists (to avoid duplicates)
SELECT cron.unschedule('generate-recurring-invoices');

-- Create the cron job
-- Runs every day at 6:00 AM UTC
SELECT cron.schedule(
  'generate-recurring-invoices',         -- job name
  '0 6 * * *',                           -- cron expression: daily at 6 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://rucuomtojzifrvplhwja.supabase.co/functions/v1/generate-recurring-invoices',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'generate-recurring-invoices';
