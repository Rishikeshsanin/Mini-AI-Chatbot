import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      webSearchEnabled: process.env.ENABLE_WEB_SEARCH === "true",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
