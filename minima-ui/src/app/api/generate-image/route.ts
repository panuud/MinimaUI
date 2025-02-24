import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { size, prompt } = await req.json();

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: size,
      quality: "standard",
      n: 1,
    });

    return NextResponse.json({ url: response.data[0].url });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}