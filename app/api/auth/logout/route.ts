import { NextResponse } from "next/server";
import { logoutCurrentSession } from "@/lib/auth";

export async function POST() {
  await logoutCurrentSession();
  const response = NextResponse.json({ message: "Logged out." });
  response.cookies.set("clinic-session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
