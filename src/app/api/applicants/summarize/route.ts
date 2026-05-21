import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractJsonObject } from "@/lib/id-extraction";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { description?: string };
    const description = body.description?.trim();
    if (!description || description.length < 10) {
      return NextResponse.json({ error: "Description too short." }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API Key is not configured." }, { status: 500 });
    }

    const prompt = `You are a concise HR assistant. Analyze the following applicant description and extract the most useful keywords for quick scanning by a recruiter.

Return ONLY a valid JSON object like this:
{
  "tags": ["Senior Dev", "5 yrs exp", "React", "Age 28", "Available now"]
}

Rules:
- Maximum 6 tags
- Each tag must be very short (1–4 words max)
- Focus on: job position, experience level, years of experience, age, skills, availability, or any standout info
- If language is Thai, keep tags in Thai
- Do not include personal ID numbers or sensitive private data

Description:
"""
${description}
"""`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Collector App Description Summarizer",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI service error." }, { status: 502 });
    }

    const aiResult = await response.json();
    const content = aiResult?.choices?.[0]?.message?.content?.trim() || "";
    const cleanJson = extractJsonObject(content);
    const parsed = JSON.parse(cleanJson) as { tags?: unknown };
    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 6)
      : [];

    return NextResponse.json({ success: true, tags });
  } catch (err) {
    console.error("summarize route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
