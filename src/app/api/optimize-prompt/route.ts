import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Enhance the prompt for poster generation
    const optimizedPrompt = `Professional poster design: ${prompt}. High quality, modern layout, visually striking, professional typography, clean composition`;

    return NextResponse.json({ optimizedPrompt });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Optimization failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
