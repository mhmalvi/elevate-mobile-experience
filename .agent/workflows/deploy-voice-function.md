---
description: How to deploy the Voice Command Edge Function
---

# Deploy Voice Command Edge Function

Follow these steps to deploy the updated `process-voice-command` function.

1. **Prerequisites**
   - Ensure you have the OpenRouter API key.
   - Create a `.env` file for the function:
     ```powershell
     cp supabase/functions/process-voice-command/.env.example supabase/functions/process-voice-command/.env
     ```
   - Edit `supabase/functions/process-voice-command/.env` and add your actual API key.

2. **Login to Supabase**
   Run the following command to authenticate with Supabase CLI:
   ```powershell
   npx supabase login
   ```
   Follow the browser instructions to log in.

3. **Deploy the Function**
   Run the deployment script:
   ```powershell
   ./scripts/deploy-voice-function.ps1
   ```

   Alternatively, you can run the commands manually:
   ```powershell
   # Set the secret (replace YOUR_KEY with actual key)
   npx supabase secrets set OPENROUTER_API_KEY=YOUR_KEY

   # Deploy the function
   npx supabase functions deploy process-voice-command
   ```

4. **Verification**
   After deployment, test the feature using the MagicMic component in the app.
