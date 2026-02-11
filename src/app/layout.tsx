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
  description: "Reserve your spot at DeMentha camp for Burning Man 2026. Join our minty oasis in Black Rock City.",
  keywords: ["Burning Man", "DeMentha", "camp", "2026", "Black Rock City", "reservation"],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "DeMentha Camp | Burning Man 2026",
    description: "Reserve your spot at DeMentha camp for Burning Man 2026.",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "DeMentha Camp Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeMentha Camp | Burning Man 2026",
    description: "Reserve your spot at DeMentha camp for Burning Man 2026.",
    images: ["/logo.png"],
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
