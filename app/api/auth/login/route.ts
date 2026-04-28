import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const { profile, session } = loginUser(email, password);
    const response = NextResponse.json({
      message: "Login successful.",
      user: {
        role: profile.role,
        name: profile.name
      }
    });
    response.cookies.set("clinic-session", session.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 401 }
    );
  }
}
