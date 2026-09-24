# Mini AI

A clean, fast, ChatGPT-style general assistant powered by Google's Gemini API.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRishikeshsanin%2FMini-AI-Chatbot&project-name=mini-ai-chatbot&repository-name=Mini-AI-Chatbot&env=GEMINI_API_KEY&envDescription=Required%20Gemini%20API%20key%20from%20Google%20AI%20Studio)

## Features

- Gemini 3.8 Flash by default
- Multi-turn conversation context
- Optional Google Search grounding for current questions
- Source links when web grounding is used
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

Then set your Gemini key in `.env.local`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Open http://localhost:3000.

## Deployment

Use the **Deploy with Vercel** button above. Set:

- `GEMINI_API_KEY` — required, encrypted
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`

Never commit a real API key.

Every push to `main` runs the GitHub Actions production build check. Once imported into Vercel, Git integration can deploy future pushes automatically.

## Notes

The **Web** toggle enables Gemini's Google Search grounding. Search grounding can have separate API usage/billing from normal model calls, depending on your Gemini plan.

Chat history is stored only in the browser's local storage in this version. There is no account system or database.

## License

For personal and portfolio use.
