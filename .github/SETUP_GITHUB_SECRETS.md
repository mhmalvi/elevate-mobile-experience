# GitHub Secrets Setup Instructions

## Required Secret for Recurring Invoice Automation

The GitHub Actions workflow needs access to your Supabase service role key to trigger the recurring invoice generation function.

### Steps to Add the Secret:

1. **Go to your GitHub repository**
   - Navigate to: `https://github.com/YOUR_USERNAME/YOUR_REPO`

2. **Access Settings**
   - Click on **Settings** tab (top navigation)

3. **Go to Secrets and Variables**
   - In the left sidebar, click **Secrets and variables**
   - Click **Actions**

4. **Add New Repository Secret**
   - Click **New repository secret** button

5. **Configure the Secret**
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Copy the `SUPABASE_SERVICE_ROLE_KEY` value from your `.env` file
     ```
     <paste your SUPABASE_SERVICE_ROLE_KEY here>
     ```
   - Click **Add secret**

### Verify Setup:

1. **Go to Actions tab** in your GitHub repository
2. Find the workflow: **Generate Recurring Invoices**
3. Click **Run workflow** to test manually
4. Check the logs to ensure it runs successfully

### Schedule:

The workflow runs automatically **every day at 00:00 UTC** (10:00 AM Australian Eastern Time).

### Manual Trigger:

You can manually trigger the workflow anytime:
- Go to **Actions** tab
- Click **Generate Recurring Invoices**
- Click **Run workflow** → **Run workflow**

### Troubleshooting:

If the workflow fails:
1. Check the logs in the Actions tab
2. Verify the secret is set correctly
3. Ensure the Supabase function is deployed: `generate-recurring-invoices`
4. Test the function manually with curl:
   ```bash
   curl -X POST \
     "https://rucuomtojzifrvplhwja.supabase.co/functions/v1/generate-recurring-invoices" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```
