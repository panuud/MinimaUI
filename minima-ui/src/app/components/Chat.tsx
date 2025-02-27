﻿"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import Image from 'next/image'

interface Message {
    role: "user" | "assistant" | "system";
    content: string | Array<{ type: string; image_url: { url: string } }>;
}

interface Conversation {
    id: string;
    timestamp: string;
    messages: Message[];
}

interface ImagesFile {
    file: File;
    base64: string;
}

export default function Chat() {
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [chatHistory, setChatHistory] = useState<Conversation[]>([]);
    const [conversationId, setConversationId] = useState<string>(uuidv4())
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [imageFiles, setImageFiles] = useState<ImagesFile[]>([]);
    const [textFiles, setTextFiles] = useState<File[]>([]);
    const [showLogin, setShowLogin] = useState(false);
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [webSearch, setWebSearch] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;
        
        // validate token
        if (await validateToken() === false){ return; }
        
        // Start a new chat
        if (input.trim() === "/new") {
            setMessages([]);
            setConversationId(uuidv4()); // Generate a new unique ID
            setInput("");
            return;
        }

        // Show chat history
        if (input.trim() === "/history") {
            setShowHistory(true);
            fetchHistory();
            setInput("");
            return;
        }

        // Trigger images selection
        if (input.trim() === "/image") {
            imageInputRef.current?.click();
            setInput("");
            return;
        }

        // Trigger file selection
        if (input.trim() === "/file") {
            fileInputRef.current?.click();
            setInput("");
            return;
        }

        // Set web search mode
        if (input.trim() === "/websearch") {
            setWebSearch(!webSearch);
            setInput("");
            return;
        }

        // Image generation
        if (input.trim().startsWith("/genimage")) {
            const regex = /^\/genimage\s+(\d{3,4}x\d{3,4})\s+"(.+)"$/;

            const match = input.trim().match(regex);
            if (!match) {
                alert("Command format: /genimage <width>x<height> \"prompt\"");
                return;
            };
          
            const [, size, prompt] = match;
            setInput("");
            setLoading(true);
            try {
                const response = await fetch("/api/generate-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ size: size, prompt: prompt }),
                });

                if (!response.ok) throw new Error("Failed to generate image");

                const { url } = await response.json();
                setMessages((prev) => {
                    const messages: Message[] = [...prev, { role: "system", content: url }]
                    saveHistory(messages);
                    return messages;
                });
            } catch {
                setMessages((prev) => {
                    const messages: Message[] = [...prev, { role: "system", content: "Failed to generate image" }]
                    saveHistory(messages);
                    return messages;
                });
            }

            setLoading(false);
            return;
        }

        const imageMessages: Message[] = imageFiles.map(image => ({
            role: "user",
            content: [
                {
                    type: "image_url",
                    image_url: {
                        url: `${image.base64}`
                    }
                }
            ]
        }));
        
        // ensure messages length is less than context window
        const LIMIT_CONTEXT_WINDOW = parseInt(process.env.NEXT_PUBLIC_LIMIT_CONTEXT_WINDOW || "50000", 10);
        const shiftedMessages: Message[] = []; 
        const contextMessages: Message[] = [...messages];
        while (true) {
            if (JSON.stringify(contextMessages).length > LIMIT_CONTEXT_WINDOW) {
                shiftedMessages.push(contextMessages.shift()!); // Store removed messages in fullHistory
            } else {
                break;
            }
        }

        const newMessages: Message[] = [...contextMessages, ...imageMessages, { role: "user", content: input }];
        setLoading(true);
        setInput("");

        try {
            const body: object = textFiles.length > 0? { messages: newMessages, fileNames: textFiles.map((file) => file.name), webSearch: webSearch }:
             { messages: newMessages, webSearch: webSearch };

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Read the streaming response from the server
            let filteredMessages: Message[] = imageFiles.length > 0? 
                newMessages.filter((msg) => !(msg.content instanceof Array)):
                newMessages;
            filteredMessages = [...shiftedMessages, ...filteredMessages];
            let assistantMessage = "";
            const updatedMessages: Message[] = [...filteredMessages, { role: "assistant", content: "" }];
            setMessages(updatedMessages);
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessage += chunk;

                // streaming response
                setMessages((prevMessages) => {
                    const updatedMessages = [...prevMessages];
                    updatedMessages[updatedMessages.length - 1] = { role: "assistant", content: assistantMessage };
                    return updatedMessages;
                });
            }

            // Save conversation to history with `conversationId`
            await saveHistory([...filteredMessages, { role: "assistant", content: assistantMessage }]);
        
        } catch (error) {
            console.error("Error:", error);
        }
        setLoading(false);
    };

    // Function to load a selected conversation
    const loadHistory = (conversation: Conversation) => {
        setMessages(conversation.messages);
        setConversationId(conversation.id);
    };

    const fetchHistory = async () => {
        try {
          const response = await fetch("/api/history");
          if (!response.ok) throw new Error("Failed to load history.");
          const history = await response.json();
          setChatHistory(history);
        } catch (error) {
          setChatHistory([]);
        }
    };

    const saveHistory = async (updatedMessages: Message[]) => {
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updatedMessages, conversationId }),
        });
    };

    const deleteMessage = async (index: number) => {
        const updatedMessages = messages.filter((_, i) => i !== index);
        setMessages(updatedMessages);
    
        await fetch("/api/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, messageIndex: index }),
        });
    };

    // Function to delete a conversation
    const deleteConversation = async (id: string) => {
        await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id }),
        });

        fetchHistory(); // Refresh history modal after deletion

        if (conversationId === id) {
        // If the current conversation is deleted, reset chat
        setMessages([]);
        setConversationId(uuidv4());
        }
    };

    // Handle Enter key
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        adjustHeight();
        sendMessage();
        }
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const MAX_HEIGHT = 200;
    // Function to adjust height automatically
    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
        textarea.style.height = "auto";  // Reset height to recalculate
        let newHeight = textarea.scrollHeight;
    
        if (newHeight > MAX_HEIGHT) {
            newHeight = MAX_HEIGHT;
            textarea.style.overflowY = "auto"; // Enable scrolling if max height is reached
        } else {
            textarea.style.overflowY = "hidden"; // Hide scrollbar when within limit
        }
    
        textarea.style.height = `${newHeight}px`;
        }
    };

    // Handles images selection
    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
    
        const fileArray = Array.from(files);
        const processedFiles: ImagesFile[] = await Promise.all(
            fileArray.map(async (file) => {
                const base64 = await fileToBase64(file);
                return { file, base64 };
            })
        );
    
        setImageFiles((prevFiles) => [...prevFiles, ...processedFiles]);
        event.target.value = "";
    };

    // Create a vector store from text files
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        setLoading(true);

        const fileArray = Array.from(files);
        setTextFiles((prevFiles) => [...prevFiles, ...fileArray]);
    
        const formData = new FormData();
        fileArray.forEach((file) => {
            formData.append("files", file);
        });

        try {
            const response = await fetch("/api/create-vectorstore", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
                const { error } = await response.json();
                setMessages((prev) => [...prev, { role: "system", content: error }]);
                setTextFiles([]);
            }
          } catch {
            setMessages((prev) => [...prev, { role: "system", content: "Failed to upload file" }]);
            setTextFiles([]);
          }
          
        setLoading(false);
        event.target.value = "";
    };

    // Function to convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleRemoveImage = (index: number) => {
        setImageFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    };

    const handleRemoveTextFile = (index: number) => {
        setTextFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    };

    const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
  
        const response = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secret: password, username: username }),
        });

        setUsername("");
        setPassword("");

        if (response.ok) {
            setShowLogin(false);
        } else {
            const message = await response.text();
            alert(message);
        }
    };

    // validate token by calling dummy API to parse the token to middleware
    const validateToken = async () => {
        const middlewareTest = await fetch("/api/validation");
        if (middlewareTest.status === 401) {
            alert("You are not authorized.");
            setShowLogin(true);
            return false;
        } else if (!middlewareTest.ok) {
            setShowLogin(true);
            alert("An error occurred.");
            return false;
        }
        return true;
    };

    useEffect(() => {
        validateToken();
    }, [])

    useEffect(() => {
        adjustHeight();
    }, [input]);
    
    useEffect(() => {
        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
          if (event.key === "Escape") {
            setShowHistory(false); // Close the modal when Esc is pressed
          }
        };
    
        // Add event listener when the modal is shown
        if (showHistory) {
          document.addEventListener("keydown", handleKeyDown);
        }
    
        // Clean up event listener when modal is hidden or component unmounts
        return () => {
          document.removeEventListener("keydown", handleKeyDown);
        };
      }, [showHistory, setShowHistory]);
          
    return (
        <div className="fixed inset-0 bg-zinc-950 flex flex-col max-w-2xl mx-auto">
            {/* login tab */}
            {showLogin && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
                    <div className="w-3/4 max-w-md">
                        <form onSubmit={handleLogin}>
                            <input type="password" className="w-full px-4 py-2 my-2 bg-zinc-950 text-white rounded-lg border border-gray-600 focus:outline-none" 
                            value={username}
                            onChange={(e)=>{setUsername(e.target.value)}} 
                            required/>
                            <input type="password" className="w-full px-4 py-2 my-2 bg-zinc-950 text-white rounded-lg border border-gray-600 focus:outline-none" 
                            value={password}
                            onChange={(e)=>{setPassword(e.target.value)}} 
                            required/>
                            <button type="submit" className="hidden"></button>
                        </form>
                        
                    </div>
                </div>
            )}

            {/* Chat messages area */}
            <div className="flex-1 overflow-y-auto max-w-full">
                {messages.map((msg, idx) => (
                    <div key={idx} >
                        <div className="flex group relative">
                            {typeof msg.content === "string" && msg.content.startsWith("http") ?
                                (<Image src={msg.content} width={500} height={500} alt="generated" className="max-w-full rounded-lg" />) :
                                (<pre className="text-left text-gray-200 break-words whitespace-pre-wrap max-w-full">{'>>> ' + msg.content}</pre>)
                            }
                            <button
                                className="hidden group-hover:inline text-red-400 text-xs absolute bottom-0 right-0"
                                onClick={() => deleteMessage(idx)}
                                >
                                ✖
                            </button>
                        </div>
                        {idx < messages.length - 1 && (
                            <hr className="w-1/2 border-dashed place-self-center my-2 border-gray-200"/>
                        )}
                    </div>
                ))}
                {loading && <p className="text-gray-400">Loading...</p>}
            </div>

            {/* Input area */}
            <div className="p-2 justify-center flex flex-col items-center">
                {/* Display imagesFiles*/}
                {imageFiles.length > 0 && (
                    <div className="mb-1 text-white text-sm self-start space-y-1">
                        {imageFiles.map((image, index) => (
                            <span
                                key={index}
                                className="cursor-pointer mx-2"
                                onClick={() => handleRemoveImage(index)}
                            >
                                {image.file.name}
                            </span>
                        ))}
                    </div>
                )}
                {/* Display textFiles */}
                {textFiles.length > 0 && (
                    <div className="mb-1 text-white text-sm self-start space-y-1">
                        {textFiles.map((file, index) => (
                            <span 
                                key={index} 
                                className="cursor-pointer mx-2"
                                onClick={() => handleRemoveTextFile(index)}
                            >
                                {file.name}
                            </span>
                        ))}
                    </div>
                )}
                <div className="relative w-full flex justify-center">
                    <textarea
                        ref={textareaRef}
                        className="w-4/5 px-4 py-1 bg-zinc-950 text-white rounded-lg border border-gray-600 focus:outline-none resize-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown} // Handle enter key
                        rows={1} // Start with one row
                    />
                    {/* Display webSearch mode */}
                    {webSearch && (
                        <span className="absolute right-3 top-1 cursor-pointer" onClick={() => setWebSearch(false)}>🌐</span>
                    )}
                </div>
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={imageInputRef}
                    onChange={handleImageChange}
                    className="hidden"
                />
                <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center pointer-events-none">
                <div className="bg-zinc-900 p-6 rounded-lg w-3/4 max-w-md pointer-events-auto">
                    <h2 className="text-lg font-semibold text-white mb-4">Chat History</h2>
                    <button
                        className="absolute top-2 right-3 text-white text-lg"
                        onClick={() => setShowHistory(false)}
                    >
                        ✖
                    </button>
                    <div className="max-h-60 overflow-y-auto">
                    {chatHistory.map((chat) => (
                        <div key={chat.id} className="flex justify-between bg-zinc-800 p-2 rounded mb-2">
                        <button onClick={() => loadHistory(chat)}>{new Date(chat.timestamp).toLocaleString()}</button>
                        <button onClick={() => deleteConversation(chat.id)} className="text-red-500">✖</button>
                        </div>
                    ))}
                    </div>
                </div>
                </div>
            )}
        </div>
    );
}