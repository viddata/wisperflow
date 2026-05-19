// app/api/stylize/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { text, profile } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback: return raw text if no API key
      return NextResponse.json({ result: text });
    }

    const client = new Anthropic({ apiKey });

    // Build style context from profile
    const styleContext = profile?.examples?.length > 0
      ? `Here are examples of how this person naturally writes:\n\n${profile.examples.map((e: string, i: number) => `Example ${i + 1}: "${e}"`).join("\n\n")}\n\nVocabulary they use: ${profile.vocab?.slice(0, 50).join(", ") || "none yet"}`
      : "No style examples provided yet. Use a neutral, clear, conversational tone.";

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a style-matching assistant. Your job is to take raw voice transcription and rewrite it so it sounds exactly like this specific person writes.

${styleContext}

Now rewrite this raw voice transcription to sound like them. Keep the meaning identical, but match their:
- Tone (casual/formal/playful etc.)
- Vocabulary choices
- Punctuation style
- Sentence length
- Any slang or shorthand they use

Raw transcription: "${text}"

Return ONLY the rewritten text, nothing else. No explanations, no quotes around it.`,
        },
      ],
    });

    const result = message.content[0].type === "text" ? message.content[0].text : text;
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Stylize error:", error);
    return NextResponse.json({ result: null, error: "Stylization failed" }, { status: 500 });
  }
}
