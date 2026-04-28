import { NextResponse } from "next/server";
import { getCurrentProfile, getDoctorProfileForUser } from "@/lib/auth";

export async function GET() {
  const { authUser, profile } = await getCurrentProfile();
  if (!authUser || !profile) {
    return NextResponse.json({ user: null });
  }

  const doctor = profile.role === "doctor" ? await getDoctorProfileForUser(profile.id) : null;
  return NextResponse.json({
    user: {
      ...profile,
      doctor
    }
  });
}
