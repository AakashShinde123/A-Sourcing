import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for hero headlines & big numerals — gives the product a
// distinctive voice instead of the default system look.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EasySourcing — Asset Verification, Audit & Reconciliation Platform",
  description: "Digitize the complete physical asset verification lifecycle: from asset-register intake to the final client-approved audit report. Every Asset. Verified. Reconciled. Accountable.",
  keywords: ["EasySourcing", "asset verification", "physical audit", "reconciliation", "field auditing", "QR asset tags"],
  authors: [{ name: "EasySourcing" }],
  manifest: "/manifest.webmanifest",
  applicationName: "ES Field",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ES Field",
  },
  openGraph: {
    title: "EasySourcing Platform",
    description: "Asset Physical Verification, Audit & Reconciliation",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Z.ai Code Scaffold",
    description: "AI-powered development with modern React stack",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f8f4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
