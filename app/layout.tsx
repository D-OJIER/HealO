import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Clinic System",
  description: "Secure AI-powered clinic appointment and prescription platform"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
