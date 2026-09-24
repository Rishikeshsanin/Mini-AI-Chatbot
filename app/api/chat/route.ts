import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiPart = { text?: string };
type GroundingChunk = { web?: { uri?: string; title?: string } };

const SYSTEM_PROMPT = `You are Mini AI, a capable general-purpose AI assistant.
Answer the user's actual question directly and accurately.
Be concise by default, but give enough detail to be genuinely useful.
Use clean Markdown when structure helps. Put code inside fenced code blocks with the correct language.
When you are uncertain, say so rather than inventing facts.
If Google Search grounding is enabled and you use current information, rely on the retrieved evidence.
Do not claim you searched the web unless the search tool was actually enabled for this request.`;

function errorMessage(status: number, raw?: string) {
  if (status === 429) return "The AI service is temporarily rate-limited. Please try again in a moment.";
  if (status === 401 || status === 403) return "The Gemini API key is invalid or does not have access to this model.";
  if (status === 404) return "The configured Gemini model is unavailable. Check GEMINI_MODEL in the deployment settings.";
  if (status === 400) return "Gemini could not process that request. Try rephrasing it.";
  return raw ? `Gemini returned an error: ${raw.slice(0, 180)}` : "The AI service is temporarily unavailable.";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Mini AI is not configured yet. Add GEMINI_API_KEY to the deployment environment." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const rawMessages = body?.messages;
    const useSearch = body?.useSearch === true;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }

    const messages: ClientMessage[] = rawMessages
      .slice(-24)
      .filter((item: unknown): item is ClientMessage => {
        if (!item || typeof item !== "object") return false;
        const value = item as Record<string, unknown>;
        return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
      })
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 12000),
      }))
      .filter((message) => message.content.length > 0);

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "The latest message must be from the user." }, { status: 400 });
    }

    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const payload: Record<string, unknown> = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.92,
        maxOutputTokens: 8192,
      },
    };

    if (useSearch) {
      payload.tools = [{ google_search: {} }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(55000),
        cache: "no-store",
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data?.error?.message || response.statusText;
      console.error("Gemini API error", response.status, detail);
      return NextResponse.json({ error: errorMessage(response.status, detail) }, { status: response.status });
    }

    const candidate = data?.candidates?.[0];
    const parts: GeminiPart[] = candidate?.content?.parts || [];
    const text = parts.map((part) => part.text || "").join("").trim();

    if (!text) {
      const reason = candidate?.finishReason;
      return NextResponse.json(
        { error: reason ? `Gemini did not return text (reason: ${reason}).` : "Gemini did not return a response." },
        { status: 502 },
      );
    }

    const chunks: GroundingChunk[] = candidate?.groundingMetadata?.groundingChunks || [];
    const seen = new Set<string>();
    const sources = chunks
      .map((chunk) => chunk.web)
      .filter((web): web is { uri: string; title?: string } => {
        if (!web?.uri || typeof web.uri !== "string") return false;
        try {
          const url = new URL(web.uri);
          if (url.protocol !== "http:" && url.protocol !== "https:") return false;
          if (seen.has(web.uri)) return false;
          seen.add(web.uri);
          return true;
        } catch {
          return false;
        }
      })
      .map((web) => ({
        url: web.uri,
        title: web.title || new URL(web.uri).hostname.replace(/^www\./, ""),
      }));

    return NextResponse.json(
      { message: text, sources, model },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
    }
    console.error("Chat route error", error);
    return NextResponse.json({ error: "Something went wrong while generating the response." }, { status: 500 });
  }
}
