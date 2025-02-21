import { NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const model = new ChatOpenAI({
      model: "chatgpt-4o-latest",
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Get streaming response from LangChain
    const stream = await model.stream(messages);

    // Create a readable stream to send the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = Array.isArray(chunk.content) 
                ? chunk.content.map(content => String(content)).join('') 
                : String(chunk.content ?? "");
            controller.enqueue(encoder.encode(text)); // Send chunk to client
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(encoder.encode("Error generating response."));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, { headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    return new Response("Something went wrong.", { status: 500 });
  }
}