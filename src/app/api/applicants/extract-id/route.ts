import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractJsonObject, normalizeExtractedIdData } from "@/lib/id-extraction";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Internal server error";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const idCardFile = formData.get("idCard") as File | null;
    if (!idCardFile || idCardFile.size === 0) {
      return NextResponse.json({ error: "No ID Card file provided." }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API Key is not configured on the server." }, { status: 500 });
    }

    // Convert image file to base64
    const buffer = Buffer.from(await idCardFile.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const mimeType = idCardFile.type || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const prompt = `You are a high-accuracy document scanner specializing in Thai identity cards. Analyze the provided identity card image and extract ONLY the non-sensitive fields listed below.

LANGUAGE PRIORITY:
- Prefer Thai language values first. If a Thai field exists on the card, use the Thai script value.
- Fall back to English/romanized values only if the Thai text is absent or unreadable.
- For fields that appear in both languages on the card (e.g. Thai name + English name), capture both.

STRICT PRIVACY RULES — NEVER extract or include:
- National ID number / citizen ID number (13-digit number)
- Passport numbers or document serial numbers
- Issue date / expiry date
- Any other government reference numbers

Extract ONLY these fields:
- fullNameTh: Full Thai name in Thai script (e.g. "นายสมชาย ใจดี") — PRIMARY, prefer this
- fullNameEn: Full English/romanized name (e.g. "MR. SOMCHAI JAIDEE") — SECONDARY
- dateOfBirth: Date of birth in ISO format YYYY-MM-DD or best approximation
- gender: Gender — prefer Thai ("ชาย" / "หญิง"), fall back to English if absent
- nationality: Nationality — prefer Thai ("ไทย"), fall back to English if absent
- address: Full registered address as printed on the card (in Thai if present). This is stored for profile use.
- faceBox: Bounding box of the face photo on the card as [ymin, xmin, ymax, xmax] percentage integers (0–100).
  On a standard Thai ID card the photo is in the lower-right corner, roughly [40, 65, 95, 95].

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "fullNameTh": "นายสมชาย ใจดี",
  "fullNameEn": "MR. SOMCHAI JAIDEE",
  "dateOfBirth": "1990-01-01",
  "gender": "ชาย",
  "nationality": "ไทย",
  "address": "123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
  "faceBox": [45, 70, 90, 92]
}`;

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Collector App ID Extraction"
      },
      body: JSON.stringify({
        model: "@preset/vision",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: dataUri
                }
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json({ error: `AI service error: ${openRouterResponse.statusText}` }, { status: 502 });
    }

    const aiResult = await openRouterResponse.json();
    const content = aiResult?.choices?.[0]?.message?.content?.trim() || "";
    const cleanJson = extractJsonObject(content);

    try {
      const parsedData = JSON.parse(cleanJson);
      const normalizedData = normalizeExtractedIdData(parsedData);
      if (!normalizedData) {
        return NextResponse.json(
          { error: "AI response did not match the expected extraction shape.", raw: content },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, data: normalizedData });
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      return NextResponse.json({ error: "Failed to parse AI response as valid structured data.", raw: content }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Error in extract-id route:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
