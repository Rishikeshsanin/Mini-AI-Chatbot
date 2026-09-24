# Mini AI

Mini AI is a clean, fast, ChatGPT-style general assistant powered by Google's Gemini API.

**Live app:** https://miniaichatbot.vercel.app

## V1 features

- Gemini 3.8 Flash as the primary model
- Automatic failover to Gemini 3.7 Flash, 3.6 Flash, and 3.5 Flash-Lite
- Multi-turn conversation context
- Safer uncertainty-aware system behavior
- Local conversation history with new/delete chat controls
- Dark and light themes
- Responsive desktop/mobile UI
- Markdown-style text and fenced code rendering
- One-click code and response copying
- Server-side API key protection
- Friendly API, quota, timeout, and configuration errors
- Health endpoint at `/api/health`
- GitHub Actions production-build verification

## Stack

- Next.js 16
- React 19
- TypeScript
- Gemini Generate Content REST API
- Vercel

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Set the environment values in `.env.local`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
ENABLE_WEB_SEARCH=false
```

Then open http://localhost:3000.

## Deployment

Import this repository into Vercel and configure:

- `GEMINI_API_KEY` — required
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`
- `ENABLE_WEB_SEARCH` — optional; keep `false` unless Google Search grounding is enabled for the API project

Never commit a real API key.

Every push to `main` runs a production build check in GitHub Actions.

## Reliability

Mini AI automatically falls back across stable Gemini Flash models when the primary model is temporarily overloaded or unavailable. Each provider attempt has a bounded timeout so the fallback chain stays inside the serverless request window.

Web Search is server-gated and disabled by default. Enabling it requires an API project/plan that supports Google Search grounding.

## Privacy

Conversation history is stored in the browser's local storage in this V1. There is no user-account database. The Gemini API key stays server-side.

## License

For personal and portfolio use.
