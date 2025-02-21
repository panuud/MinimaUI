import { NextResponse, NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const historyFile = path.join(process.cwd(), "chatHistory.json");

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId } = await req.json();

    let history: any[] = [];
    try {
      const data = await fs.readFile(historyFile, "utf-8");
      history = JSON.parse(data);
    } catch (error) {
      console.log("No existing history file, creating a new one.");
    }

    // Find the conversation by ID and update it, otherwise add a new one
    const existingIndex = history.findIndex((conv) => conv.id === conversationId);
    if (existingIndex !== -1) {
      history[existingIndex].messages = messages;
    } else {
      history.push({ id: conversationId, timestamp: new Date().toISOString(), messages });
    }

    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));

    return NextResponse.json({ message: "History saved!" });
  } catch (error) {
    console.error("Error saving history:", error);
    return new Response("Error saving history", { status: 500 });
  }
}

export async function GET() {
  try {
    const data = await fs.readFile(historyFile, "utf-8");
    const history = JSON.parse(data);
    return NextResponse.json(history);
  } catch (error) {
    console.log("No history available.");
    return new Response("No history available.", { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
    try {
      const { conversationId, messageIndex } = await req.json();
  
      let history: any[] = [];
      try {
        const data = await fs.readFile(historyFile, "utf-8");
        history = JSON.parse(data);
      } catch (error) {
        console.log("No history found.");
      }
  
      // Find conversation
      const convIndex = history.findIndex((conversation) => conversation.id === conversationId);
      if (convIndex === -1) return new Response("Conversation not found.", { status: 404 });
  
      // Remove specific message
      if (messageIndex !== undefined) {
        history[convIndex].messages.splice(messageIndex, 1);
      } else {
        // Filter out the conversation to delete
        history = history.filter((conversation) => conversation.id !== conversationId);
      }
  
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
      
      return NextResponse.json({ message: "Message deleted successfully!" });
    } catch (error) {
      console.error("Error deleting message:", error);
      return new Response("Error deleting message", { status: 500 });
    }
  }