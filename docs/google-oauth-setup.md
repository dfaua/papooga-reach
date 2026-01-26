# Google OAuth Setup Guide

This guide walks through setting up Google Cloud credentials for Gmail API integration.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top left) → **New Project**
3. Name it (e.g., "Papooga Email") → **Create**
4. Make sure the new project is selected

## Step 2: Enable Gmail API

1. Go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Gmail API** → **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → **Create**
3. Fill in:
   - App name: `Papooga`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. **Scopes** page → **Add or Remove Scopes**
   - Search and add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Click **Update** → **Save and Continue**
6. **Test users** → **Add Users** → add your Gmail address
7. **Save and Continue** → **Back to Dashboard**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Papooga Web`
5. **Authorized redirect URIs** → Add:
   ```
   http://localhost:3000/api/google/callback
   ```
   For production, also add your production URL:
   ```
   https://yourdomain.com/api/google/callback
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

## Step 5: Add Environment Variables

Add these to your `.env.local`:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

## Required Scopes

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read emails from inbox and sent folder |
| `gmail.send` | Send emails on behalf of user |
| `gmail.modify` | Mark emails as read, archive, etc. |

## Notes

- For development, your app will be in "Testing" mode, limited to test users you add
- For production, you'll need to verify your app with Google (takes a few days)
- Tokens are refreshed automatically using the refresh_token
