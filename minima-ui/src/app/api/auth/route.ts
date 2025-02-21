import { NextRequest } from "next/server";
import  { SignJWT }  from "jose"
import { cookies } from "next/headers";

const failedAttempts = new Map();
const JWT_SECRET = process.env.JWT_SECRET as string;

export async function POST(req: NextRequest) {
  try {
    // Fetch user's IP address safely
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown"; 
    console.log("Client IP login request: " + clientIp + ` (${failedAttempts.get(clientIp)})`);
    const { secret } = await req.json();

    // Initialize failed attempts
    if (!failedAttempts.has(clientIp)) {
      failedAttempts.set(clientIp, 0);
    }

    // Check if the user is blocked
    if (failedAttempts.get(clientIp) >= 5) {
      return new Response("Too many failed attempts.", { status: 403 });
    }

    if (secret !== process.env.SECRET) {
      // Increment failed attempts
      failedAttempts.set(clientIp, failedAttempts.get(clientIp) + 1);
      return new Response("Incorrect", { status: 401 });
    }

    // Successful login -> Reset failed attempts
    failedAttempts.set(clientIp, 0);

    // Create JWT
    const token = await new SignJWT({ auth: true, ip: clientIp })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(JWT_SECRET));

    // Set cookie with JWT
    (await
      // Set cookie with JWT
      cookies()).set("eieiaroijang", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 3600, // 1 hour
    });
    
    return new Response(JSON.stringify({ message: "Authorized" }), { status: 200 });
  } catch (error) {
    console.error("Error auth:", error);
    return new Response("Error auth", { status: 500 });
  }
}