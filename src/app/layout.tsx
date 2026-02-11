import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeMentha Camp | Burning Man 2026",
  description: "Reserve your spot at DeMentha camp for Burning Man 2026. Join our community in Black Rock City.",
  keywords: ["Burning Man", "DeMentha", "camp", "2026", "Black Rock City", "reservation"],
  openGraph: {
    title: "DeMentha Camp | Burning Man 2026",
    description: "Reserve your spot at DeMentha camp for Burning Man 2026.",
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
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased min-h-screen bg-gradient-to-b from-slate-900 to-slate-800`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
