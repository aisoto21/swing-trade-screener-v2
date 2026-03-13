import type { Metadata } from "next";
import { Inter, DM_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MarketStatusBar } from "@/components/layout/MarketStatusBar";
import { RegimeProvider } from "@/components/layout/RegimeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EdgeScreen Pro - Swing Trade Stock Screener",
  description: "Professional-grade swing trade stock screener for active traders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${dmMono.variable} font-sans antialiased`}>
        <Providers>
          <MarketStatusBar />
          <RegimeProvider />
          {children}
        </Providers>
      </body>
    </html>
  );
}
