import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { writeFile, unlink } from "fs/promises";
import unidecode from 'unidecode';
import { jwtVerify } from "jose";

// directory
const vectorstoreDir = path.join(process.cwd(), "data/vectorstore");
const uploadDir = path.join(process.cwd(), "data/uploads");

// Ensure the vector store directory exists before saving
const ensureDirectory = (userKey: string) => {
  const vectorStoreDirWithUserKey = path.join(vectorstoreDir, userKey);
    if (!fs.existsSync(vectorStoreDirWithUserKey)) {
        fs.mkdirSync(vectorStoreDirWithUserKey, { recursive: true });
        console.log("Created vectorstore directory:", vectorStoreDirWithUserKey);
    }
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("Created uploads directory:", uploadDir);
    }
};

const JWT_SECRET = process.env.JWT_SECRET!;
const secret = new TextEncoder().encode(JWT_SECRET);

interface JwtPayload {
  auth: boolean;
  ip: string;
  username: string;
}

export async function POST(req: NextRequest) {
  try {
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

    ensureDirectory(userKey);

    const data = await req.formData();
    const files: File[] = Array.from(data.getAll("files")) as File[];

    if (files.length === 0) {
        return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Initialize LangChain FAISS vector store
    const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });

    for (const file of files) {
      const vectorStore = new FaissStore(embeddings, {});

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Save PDF temporarily
      const filePath = path.join(uploadDir, file.name);;
      await writeFile(filePath, buffer);

      // Process PDF
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 2000,
          chunkOverlap: 200,
      });
      const splits = await splitter.splitDocuments(docs);

      // Add splits to FAISS vector store
      await vectorStore.addDocuments(splits);
      // Delete temporary file after processing
      await unlink(filePath);
      
      // safe ANCII file path
      const safeFileName = unidecode(path.parse(file.name).name);
      await vectorStore.save(path.join(vectorstoreDir, userKey, safeFileName));
    }

    return NextResponse.json({ message: "All texts processed successfully!" });
  } catch (error) {
    console.error("Error processing text:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}