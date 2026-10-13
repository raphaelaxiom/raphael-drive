import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raphael Drive — Neon City Driving | Original WebGL Game by Raphael",
  description:
    "Raphael Drive is an original browser driving game: tune your car in the garage, then drift a rainy neon city at night. Arcade physics, nitro, checkpoints, procedural synthwave radio. Built with Three.js and WebAudio.",
  keywords: ["driving game", "browser game", "cyberpunk", "neon city", "Three.js", "Raphael Drive"],
  authors: [{ name: "Raphael" }],
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  openGraph: {
    type: "website",
    title: "Raphael Drive — Neon City Driving",
    description: "An original neon-city driving game in the browser. Garage, drift, nitro, checkpoints, synthwave radio.",
    siteName: "Raphael Drive",
  },
  twitter: { card: "summary_large_image", title: "Raphael Drive — Neon City Driving", description: "Original neon-city driving game in the browser." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07060e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
