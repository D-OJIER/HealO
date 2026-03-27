import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Healoz | Healthcare MVP",
  description: "AI triage, doctor discovery, and appointment booking platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col">
          <header className="flex items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold text-zinc-900">
              Healoz
            </Link>
            <nav className="flex items-center gap-3">
              <Link href="/patient" className="text-sm text-zinc-700 hover:text-zinc-900">
                Patient
              </Link>
              <Link href="/doctor" className="text-sm text-zinc-700 hover:text-zinc-900">
                Doctor
              </Link>
              <Link href="/appointments" className="text-sm text-zinc-700 hover:text-zinc-900">
                Appointments
              </Link>
              <SignOutButton />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
