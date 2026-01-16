import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeMentha Camp | Burning Man 2025",
  description: "Reserve your spot at DeMentha camp for Burning Man 2025. Join our community in Black Rock City.",
  keywords: ["Burning Man", "DeMentha", "camp", "2025", "Black Rock City", "reservation"],
  openGraph: {
    title: "DeMentha Camp | Burning Man 2025",
    description: "Reserve your spot at DeMentha camp for Burning Man 2025.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-b from-slate-900 to-slate-800`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
