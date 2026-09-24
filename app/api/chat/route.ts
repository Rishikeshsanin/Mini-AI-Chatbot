import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiPart = { text?: string };
type GroundingChunk = { web?: { uri?: string; title?: string } };

const SYSTEM_PROMPT = `You are Mini AI, a capable, careful general-purpose AI assistant.

Core behavior:
- Answer the user's actual question directly and accurately.
- Be concise by default, but give enough detail to be genuinely useful.
- Use clean Markdown when structure helps. Put code inside fenced code blocks with the correct language.
- Never invent facts, personal details, calculations, etymologies, citations, sources, or capabilities.
- If important information is missing, say exactly what is missing and either ask for it or give only the part that can be answered reliably.
- Clearly distinguish established facts from estimates, interpretations, traditions, opinions, or speculation.
- Do not overstate confidence. If uncertain, say so plainly.
- Avoid generic follow-up questions at the end unless they genuinely help continue the user's task.
- Do not unnecessarily repeat sensitive or personal details the user provided.

Special cases:
- Astrology, numerology, tarot, personality typing, and similar systems should be presented as traditional or entertainment-style interpretations, not scientific facts or reliable predictions. Do not fabricate a birth chart. If an exact chart needs birthplace, date, or time and one is missing, state that limitation.
- For names and surnames, only give etymology you are reasonably confident about. If the surname origin is uncertain, say so rather than making up lineage claims.
- For current information, do not imply freshness or web access unless Google Search grounding was actually enabled for that request.
- If Google Search grounding is enabled, rely on retrieved evidence and keep claims aligned with it.`;

const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

function modelChain() {
  const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  return [primary, ...FALLBACK_MODELS].filter(
    (model, index, all) => all.indexOf(model) === index,
  );
}

function errorMessage(status: number) {
  if (status === 429) return "The AI service is rate-limited right now. Please try again shortly.";
  if (status === 401 || status === 403) return "The Gemini API key is invalid or does not have access to this request.";
  if (status === 404) return "The configured Gemini models are temporarily unavailable.";
  if (status === 400) return "Gemini could not process that request. Try rephrasing it.";
  if (status >= 500) return "Gemini is temporarily busy. Please try again in a moment.";
  return "The AI service is temporarily unavailable.";
}

function shouldFallback(status: number) {
  return status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function callGemini(
  model: string,
  apiKey: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => null);
  return { response, data };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Mini AI is not configured yet. Add GEMINI_API_KEY to the deployment environment." },
      { status: 503 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const rawMessages = body?.messages;
    const useSearch =
      process.env.ENABLE_WEB_SEARCH === "true" &&
      body?.useSearch === true;

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
        maxOutputTokens: 8192,
      },
    };

    if (useSearch) {
      payload.tools = [{ google_search: {} }];
    }

    let finalResponse: Response | null = null;
    let finalData: any = null;
    let modelUsed = "";
    let lastStatus = 503;

    for (const model of modelChain()) {
      try {
        const { response, data } = await callGemini(model, apiKey, payload);
        finalResponse = response;
        finalData = data;
        modelUsed = model;

        if (response.ok) break;

        lastStatus = response.status;
        const detail = data?.error?.message || response.statusText;

        if (!shouldFallback(response.status)) {
          console.error("Gemini API error", model, response.status, detail);
          return NextResponse.json(
            { error: errorMessage(response.status) },
            { status: response.status },
          );
        }

        console.warn("Gemini model unavailable, trying fallback", model, response.status, detail);
      } catch (error) {
        lastStatus = 504;
        console.warn(
          "Gemini model request failed, trying fallback",
          model,
          error instanceof Error ? error.message : "Request failed",
        );
      }
    }

    if (!finalResponse?.ok) {
      console.error("All Gemini models failed", lastStatus);
      return NextResponse.json(
        { error: errorMessage(lastStatus) },
        { status: lastStatus },
      );
    }

    const candidate = finalData?.candidates?.[0];
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
      { message: text, sources, model: modelUsed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Chat route error", error);
    return NextResponse.json({ error: "Something went wrong while generating the response." }, { status: 500 });
  }
}
