import { NextResponse, NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { jwtVerify } from "jose";

const historyFile = path.join(process.cwd(), "chatHistory.json");
const JWT_SECRET = process.env.JWT_SECRET!;
const secret = new TextEncoder().encode(JWT_SECRET);

interface JwtPayload {
  auth: boolean;
  ip: string;
  username: string;
}

export async function POST(req: NextRequest) {
  try {
    // Extract user's username and ip from their JWT and use it as a key 
    const token = req.cookies.get("eieiaroijang")?.value;
    let userKey: string;

    if (!token) return new Response("Unauthorized", { status: 401 });
    try{
      const { payload } = await jwtVerify(token, secret) as { payload: JwtPayload };
      userKey = payload.username + payload.ip;
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages, conversationId } = await req.json();

    let history: Record<string, any> = {};
    try {
      const data = await fs.readFile(historyFile, "utf-8");
      history = JSON.parse(data);
    } catch {
      console.log("No existing history file, creating a new one.");
    }

    // Ensure user-specific storage exists
    if (!history[userKey]) history[userKey] = [];

    // Find the conversation by ID and update it, otherwise add a new one
    const existingIndex = history[userKey].findIndex((conv: any) => conv.id === conversationId);
    if (existingIndex !== -1) {
      history[userKey][existingIndex].messages = messages;
    } else {
      history[userKey].push({ id: conversationId, timestamp: new Date().toISOString(), messages });
    }

    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));

    return NextResponse.json({ message: "History saved!" });
  } catch (error) {
    console.error("Error saving history:", error);
    return new Response("Error saving history", { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("eieiaroijang")?.value;
    let userKey: string;

    if (!token) return new Response("Unauthorized", { status: 401 });
    try{
      const { payload } = await jwtVerify(token, secret) as { payload: JwtPayload };
      userKey = payload.username + payload.ip;
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    const data = await fs.readFile(historyFile, "utf-8");
    const history = JSON.parse(data);

    return NextResponse.json(history[userKey] || []);
  } catch (error) {
    console.log("No history available.");
    return new Response("No history available.", { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
    try {
      const token = req.cookies.get("eieiaroijang")?.value;
      let userKey: string;

      if (!token) return new Response("Unauthorized", { status: 401 });
      try{
        const { payload } = await jwtVerify(token, secret) as { payload: JwtPayload };
        userKey = payload.username + payload.ip;
      } catch {
        return new Response("Unauthorized", { status: 401 });
      }

      const { conversationId, messageIndex } = await req.json();
  
      let history: Record<string, any> = [];
      try {
        const data = await fs.readFile(historyFile, "utf-8");
        history = JSON.parse(data);
      } catch (error) {
        console.log("No history found.");
      }
      if (!history[userKey]) return new Response("No history available", { status: 404 });

      // Find conversation
      const convIndex = history[userKey].findIndex((conversation: any) => conversation.id === conversationId);
      if (convIndex === -1) return new Response("Conversation not found.", { status: 404 });
  
      // Remove specific message
      if (messageIndex !== undefined) {
        history[userKey][convIndex].messages.splice(messageIndex, 1);
      } else {
        // Filter out the conversation to delete
        history[userKey] = history[userKey].filter((conversation: any) => conversation.id !== conversationId);
      }
  
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
      
      return NextResponse.json({ message: "Message deleted successfully!" });
    } catch (error) {
      console.error("Error deleting message:", error);
      return new Response("Error deleting message", { status: 500 });
    }
  }