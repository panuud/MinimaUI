import { NextRequest } from "next/server";
import path from "path";
import { OpenAIEmbeddings } from "@langchain/openai";
import fs from "fs";
import { ChatOpenAI } from "@langchain/openai";
import unidecode from 'unidecode';
import { jwtVerify } from "jose";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { search, SafeSearchType } from 'duck-duck-scrape';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const JWT_SECRET = process.env.JWT_SECRET!;
const secret = new TextEncoder().encode(JWT_SECRET);

interface JwtPayload {
  auth: boolean;
  ip: string;
  username: string;
}

async function getWebSearchContents(searchQuery: string, maxResults: number) {
  const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
  const vectorStore = new MemoryVectorStore(embeddings, {});

  const urls = (await search(searchQuery)).results.map(result => result.url);
  const webSearchresults = [];
  maxResults = Math.min(maxResults, urls.length);
  for (let i = 0; i < maxResults; i++) {
      const loader = new PuppeteerWebBaseLoader(urls[i], {
          launchOptions: { headless: true },
          gotoOptions: { waitUntil: "domcontentloaded" }, // Load when DOM content is loaded
          evaluate: async (page) => {
              return page.evaluate(() => {
              // Extract text only from the <body> tag, removing scripts and styles
              return document.body.innerText.trim();
              });
          },
      });
  
      const documents = await loader.load();
      webSearchresults.push(documents.map(doc => ({
          metadata: doc.metadata,
          pageContent: doc.pageContent
      })));
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  for (const result of webSearchresults) {
    const splits = await splitter.splitDocuments(result);
    await vectorStore.addDocuments(splits);
  }

  const retriever = vectorStore.asRetriever({ k: 7 });
  const results = await retriever.invoke(searchQuery);

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, fileNames, webSearch } = await req.json();

    // get userkey
    const token = req.cookies.get("eieiaroijang")?.value;
    let userKey: string;

    if (!token) return new Response("Unauthorized", { status: 401 });
    try{
      const { payload } = await jwtVerify(token, secret) as { payload: JwtPayload };
      userKey = unidecode(payload.username + payload.ip).replace(/[^a-zA-Z0-9 ]/g, '');
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    //trigger web search
    if (webSearch) {
      //create search query
      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        streaming: true,
        apiKey: process.env.OPENAI_API_KEY,
      });
      const queryResult = await model.invoke([...messages, { role: "user", content: "Generate a search query based on the previous chat conversation. Respond with only the query and nothing else. Do not include any explanations, introductions, or additional text—only the query itself." }]);
      let searchQuery = queryResult.content as string;
      searchQuery = searchQuery.replace(/[^a-zA-Z0-9 ]/g, '');

      //get web search contents
      const webSearchContents = await getWebSearchContents(searchQuery, 10);

      const lastMessage: string = messages[messages.length - 1];
      messages.pop();
      messages.push( { role: "system", content: "Here are the contents from a web search." });
      messages.push( { role: "system", content: JSON.stringify(webSearchContents) });
      messages.push(lastMessage);
    }

    //trigger RAG
    if (fileNames) {
      const vectorstoreDir = path.join(process.cwd(), "data/vectorstore");
      const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
      const vectorStore = new MemoryVectorStore(embeddings, {});
      
      //prepare vector store
      for (const file of fileNames) {
        const fileName = path.parse(file).name;
        const safeFileName = unidecode(fileName);
        const vectorStorePath = path.join(vectorstoreDir, userKey, `${safeFileName}.json`);

        if (!fs.existsSync(vectorStorePath)) {
          return new Response("Vector path does not exist.", { status: 404 });
        }

        // Load JSON index from file
        const vectorStoreData = JSON.parse(fs.readFileSync(vectorStorePath, 'utf-8'));

        // Create a new MemoryVectorStore and assign the loaded data
        const loadedVectorStore = new MemoryVectorStore(embeddings);
        loadedVectorStore.memoryVectors = vectorStoreData;
        
        // Merge the loaded vectors into the global vector store
        vectorStore.memoryVectors.push(...loadedVectorStore.memoryVectors);
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