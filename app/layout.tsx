import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Geist Mono shipped as a local variable font (app/fonts) — used for code,
// API keys, and agent trace output per the design system.
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mosaic — Multi-Agent AI Workspace",
  description:
    "A multi-client, multi-agent AI orchestration workspace. Pieces come together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          geistMono.variable,
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
