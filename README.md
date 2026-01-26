# Papooga - LinkedIn Sales Navigator Outreach Assistant

A self-hosted LinkedIn outreach tool with AI-powered message personalization. Save leads from LinkedIn Sales Navigator, manage your pipeline, and send personalized connection requests and messages.

## Features

- **Chrome Extension**: Save leads and companies directly from LinkedIn Sales Navigator
- **Pipeline Management**: Track leads through stages (saved → requested → accepted → messaged → replied)
- **Message Templates**: Create reusable templates with variables for personalization
- **AI Personalization**: Generate personalized messages using Gemini or Groq AI
- **Company Tracking**: Save and track companies with enrichment data
- **Apollo Integration**: Enrich contacts with email and phone data via Apollo.io
- **ZeroBounce Integration**: Verify email addresses before sending
- **Gmail Integration**: Send emails directly from the app (OAuth)
- **Real-time Updates**: Live updates via Supabase subscriptions
- **Todo System**: Track follow-ups and tasks per contact

## Architecture

- **Web App**: Next.js 16 + React 19 + Tailwind CSS (runs locally on port 3000)
- **Database**: Supabase (hosted PostgreSQL with real-time subscriptions)
- **Chrome Extension**: Manifest V3 extension for Sales Navigator integration

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- Chrome browser
- LinkedIn Sales Navigator subscription (for the extension to work)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-username/papooga.git
cd papooga

# Install web app dependencies
npm install

# Install extension dependencies
cd extension && npm install && cd ..
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to Project Settings → API to get your URL and anon key
3. Run the database migrations:

```bash
# Link your project (you'll need the Supabase CLI)
npx supabase login
npx supabase link --project-ref your-project-ref

# Push migrations to your database
npx supabase db push
```

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env.local

# Edit .env.local with your values
```

Required environment variables:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API key for extension auth (generate with: openssl rand -hex 32)
API_KEY=your_random_api_key
NEXT_PUBLIC_API_KEY=your_random_api_key
```

Optional (for AI personalization):
```
GEMINI_API_KEY=your_gemini_key      # https://aistudio.google.com/apikey
GROQ_API_KEY=your_groq_key          # https://console.groq.com/keys
```

Optional (for enrichment):
```
APOLLO_API_KEY=your_apollo_key      # https://developer.apollo.io/keys
ZEROBOUNCE_API_KEY=your_zb_key      # https://www.zerobounce.net/members/API
```

Optional (for Gmail sending):
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

### 4. Start the Web App

```bash
npm run dev
```

The app will run at [http://localhost:3000](http://localhost:3000).

**Important**: The app must run on port 3000 as the Chrome extension is configured to communicate with this port.

### 5. Install the Chrome Extension

1. Build the extension:
```bash
cd extension
npm run build
```

2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension/dist` folder

### 6. Configure the Extension

1. Click the Papooga extension icon in Chrome
2. Enter your API key (same as `API_KEY` in .env.local)
3. API URL should be `http://localhost:3000` (default)
4. Click "Save"

## Usage

### Saving Leads

1. Go to LinkedIn Sales Navigator
2. Open a lead profile (`/sales/lead/...`)
3. Click the "Save to Papooga" button that appears
4. The lead will be saved with their info and linked to their company if it exists

### Saving Companies

1. Go to a company page in Sales Navigator (`/sales/company/...`)
2. Click the "Save to Papooga" button
3. Company info will be extracted and saved

### Managing Pipeline

1. Open [http://localhost:3000](http://localhost:3000)
2. Use the tabs to switch between People, Companies, Messaging, etc.
3. Click on status badges to update lead stages
4. Add notes and todos to track follow-ups

### Sending Messages

1. Go to the Messaging tab
2. Select a profile and template
3. Choose leads to message
4. AI will personalize messages based on the template and lead data
5. Copy messages to send via LinkedIn, or use Gmail integration for emails

## Project Structure

```
papooga/
├── app/                    # Next.js app
│   ├── api/               # API routes
│   ├── components/        # React components
│   ├── lib/               # Utilities (Supabase client, auth)
│   └── page.tsx           # Main dashboard
├── extension/             # Chrome extension
│   ├── src/
│   │   ├── background/    # Service worker
│   │   ├── content/       # Content scripts for LinkedIn
│   │   ├── lib/           # Shared utilities
│   │   └── popup/         # Extension popup UI
│   └── manifest.json
├── supabase/
│   └── migrations/        # Database migrations
└── .env.example           # Environment template
```

## Database Schema

Key tables:
- `companies` - Company records with LinkedIn data
- `people` - Lead/contact records linked to companies
- `profiles` - ICP (Ideal Customer Profile) definitions
- `message_templates` - Reusable message templates
- `messages` - Message history
- `todos` - Follow-up tasks
- `google_emails` - Gmail OAuth tokens

## Troubleshooting

### Extension not connecting
- Make sure the web app is running on port 3000
- Check that your API key matches in both .env.local and extension settings
- Open extension service worker console for errors: `chrome://extensions/` → Papooga → "Service worker"

### Slow extension responses
- This is a known Chrome MV3 service worker issue
- The extension includes keep-alive mechanisms, but first request after idle may be slow

### Database connection issues
- Verify your Supabase URL and anon key
- Check that RLS (Row Level Security) policies allow access
- Ensure migrations have been applied

## Development

### Regenerate TypeScript Types

After changing the database schema:
```bash
npm run types:generate
```

### Extension Development

```bash
cd extension
npm run dev  # Watch mode with hot reload
```

## License

MIT with Commons Clause - See [LICENSE](LICENSE) for details.

Free for personal use. Commercial use requires a license.

## Author

Danyil Fedyna
