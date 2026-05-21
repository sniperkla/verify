import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractJsonObject, normalizeFaceBox } from "@/lib/id-extraction";

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
    const imageFile = formData.get("image") as File | null;
    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API Key is not configured on the server." }, { status: 500 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const mimeType = imageFile.type || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const prompt = `You are a face detection assistant. Analyze the uploaded image and find the single most prominent visible human face, including selfies and standard portrait photos.

Return ONLY a valid JSON object.

If a visible human face exists, return:
{
  "faceBox": [ymin, xmin, ymax, xmax]
}

Rules:
- faceBox must contain 4 numbers representing percentages from 0 to 100.
- Use the format [ymin, xmin, ymax, xmax].
- The box should tightly cover the visible face area.
- If multiple people exist, return the largest or most central face only.
- If no visible human face is present, return:
{
  "faceBox": null
}`;

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Collector App Face Detection",
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
                  url: dataUri,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error("OpenRouter face detection error:", errorText);
      return NextResponse.json({ error: `AI service error: ${openRouterResponse.statusText}` }, { status: 502 });
    }

    const aiResult = await openRouterResponse.json();
    const content = aiResult?.choices?.[0]?.message?.content?.trim() || "";
    const cleanJson = extractJsonObject(content);

    try {
      const parsedData = JSON.parse(cleanJson) as { faceBox?: unknown } | null;
      const faceBox = normalizeFaceBox(parsedData?.faceBox);
      if (!faceBox) {
        return NextResponse.json({ error: "No human face detected in the uploaded image." }, { status: 422 });
      }

      return NextResponse.json({ success: true, data: { faceBox } });
    } catch {
      console.error("Failed to parse face detection response as JSON:", content);
      return NextResponse.json({ error: "Failed to parse AI response as valid face data.", raw: content }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Error in detect-face route:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
