import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET!;
const secret = new TextEncoder().encode(JWT_SECRET);

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("eieiaroijang")?.value;

  // Allow public access to the auth API
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!token) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Extract user IP
    const forwardedFor = req.headers.get("x-forwarded-for");
    const currentIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

    // Verify JWT
    const { payload } = await jwtVerify(token, secret);
    if (payload.auth !== true || payload.ip !== currentIp) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }
    return NextResponse.next();
  } catch (error) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Protect API routes
export const config = {
  matcher: ["/api/:path*"],
};