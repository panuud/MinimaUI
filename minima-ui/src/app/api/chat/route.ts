import { NextRequest } from "next/server";
import path from "path";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import fs from "fs";
import { ChatOpenAI } from "@langchain/openai";
import unidecode from 'unidecode';

export async function POST(req: NextRequest) {
  try {
    const { messages, fileNames } = await req.json();

    //trigger RAG
    if (fileNames) {
      const vectorstoreDir = path.join(process.cwd(), "data/vectorstore");
      const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
      const vectorStore = new FaissStore(embeddings, {});
      
      //prepare vector store
      for (const file of fileNames) {
          const fileName = path.parse(file).name;
          const safeFileName = unidecode(fileName);
          const vectorStorePath = path.join(vectorstoreDir, safeFileName);
  
          if (!fs.existsSync(vectorStorePath)) {
              return new Response("Vector path does not exist.", { status: 404 });
          }
  
          const loadVectorStore = await FaissStore.load(vectorStorePath, embeddings);
          await vectorStore.mergeFrom(loadVectorStore);
      }
  
      //get last message for rag
      const lastMessage: string = messages[messages.length - 1];
      const lastMessageContent: string = messages[messages.length - 1].content;
      const retriever = vectorStore.asRetriever({ k: 5 });
      const results = await retriever.invoke(lastMessageContent);

      messages.pop();
      messages.push( { role: "system", content: "Here are some related documents" });
      messages.push( { role: "system", content: JSON.stringify(results) });
      messages.push(lastMessage);
    }

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
    console.error("Error processing chat:", err);
    return new Response("Something went wrong.", { status: 500 });
  }
}