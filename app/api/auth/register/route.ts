import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { role, name, email, password, phone, registrationNumber } = await request.json();
    const { doctor } = registerUser({
      role,
      name,
      email,
      password,
      phone,
      registrationNumber
    });

    return NextResponse.json({
      message:
        role === "doctor"
          ? doctor?.verification_status === "verified"
            ? "Doctor account created and verified against the trusted local registry."
            : "Doctor account created, but registry verification failed. Access stays restricted."
          : "Patient account created successfully."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Registration failed.",
        details: "Local registration failed."
      },
      { status: 400 }
    );
  }
}
