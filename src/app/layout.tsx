import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// Police arrondie proche de la typographie Airtel (remplaçable par la police officielle).
const brandFont = Nunito({ subsets: ["latin"], variable: "--font-brand", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Airtel RDC · Self KYC", template: "%s · Airtel RDC" },
  description: "Identifiez vous-même votre carte SIM Airtel en quelques minutes.",
};

export const viewport: Viewport = {
  themeColor: "#e40000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={brandFont.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
