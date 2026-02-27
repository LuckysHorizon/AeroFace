# Google Maps API Configuration for Supabase Edge Function

## Quick Setup

### Step 1: Get Your Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "NEW PROJECT"
3. Name it "AeroFace" → Create
4. Search for "Places API" → Enable
5. Search for "Maps JavaScript API" → Enable
6. Go to "Credentials" in sidebar
7. Click "Create Credentials" → "API Key"
8. Copy the key (it looks like: `AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 2: Add Key to Supabase Edge Function

**Via Supabase Dashboard:**

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Functions** in sidebar (left menu)
4. Find **fetch-lounges** function
5. Click on it
6. Go to **Configuration** tab
7. Under "Secrets", click "Add New Secret"
8. Key: `GOOGLE_MAPS_API_KEY`
9. Value: `paste-your-api-key-here`
10. Save

**Via Supabase CLI:**

```bash
supabase secrets set GOOGLE_MAPS_API_KEY="your-api-key-here" --project-ref YOUR_PROJECT_REF
```

### Step 3: Verify in Edge Function

The code in `supabase/functions/fetch-lounges/index.ts` automatically reads the secret:

```typescript
const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
if (!googleApiKey) {
  throw new Error("Google Maps API key not configured");
}
```

---

## Security Best Practices

✅ **What We Do Right:**
- API key stored in Supabase Secrets (NOT in code)
- API key never exposed to frontend
- Only accessible within Edge Function server
- Can't be extracted from mobile app

🚫 **Never Do This:**
- Don't put API key in frontend code
- Don't commit API key to GitHub
- Don't hardcode in .env file

---

## Testing the Setup

After adding the API key:

1. Go to Lounges tab in mobile app
2. Grant location permission
3. Should see lounges loading
4. Check Supabase Functions Logs if error:
   - Dashboard → Functions → Deployments
   - Click fetch-lounges → Logs tab
   - See real-time execution logs

---

## If You Get "Google API key not configured" Error

**Common Causes:**
1. ❌ Secret not saved (click SAVE button!)
2. ❌ Typo in secret name (must be exactly: `GOOGLE_MAPS_API_KEY`)
3. ❌ Google API key invalid or expired
4. ❌ Google APIs not enabled in Cloud Console

**Fix:**
1. Double-check secret name: `GOOGLE_MAPS_API_KEY` (case-sensitive!)
2. Double-check API key value (no spaces, copy-paste exactly)
3. In Google Cloud Console, verify:
   - Places API is enabled
   - Maps JavaScript API is enabled
   - API key has no restrictions (or unrestrict temporarily for testing)

---

## Cost Control

You can monitor your API usage:

1. Google Cloud Console → "APIs & Services" → "Credentials"
2. Click your API key
3. Go to "Application restrictions"
4. Set "HTTP referrers" to restrict to your domain only
5. Go to "API restrictions"
6. Select only "Places API" and "Maps JavaScript API"
7. Set daily quota limits if needed

---

## Recommendation for Production

For production deployment:

1. **Restrict API Key by IP:**
   - Application restrictions: "IP addresses"
   - Add your Supabase Edge Function IP ranges

2. **Enable Billing Alert:**
   - Go to Google Cloud Console → Billing
   - Set budget alerts for $50-100/month

3. **Monitor Usage:**
   - Check Google Cloud Console → APIs & Services → Quotas
   - Monitor Supabase Edge Function logs regularly

---

**Done!** Your Edge Function can now call the Google Places API securely.
