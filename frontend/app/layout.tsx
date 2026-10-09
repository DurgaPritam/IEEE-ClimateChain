import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AppStateProvider } from "@/components/shell/AppState";
import "./globals.css";

const sans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "VERDANT-X",
  description: "Verified, private, quantum-safe CBAM emissions for cement. Synthetic demo data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg text-ink">
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
