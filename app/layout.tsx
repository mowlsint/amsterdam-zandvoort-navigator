import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://amsterdam-zandvoort-navigator.mowlsint.chatgpt.site"),
  title: "Amsterdam × Zandvoort 2026",
  description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix in Zandvoort.",
  applicationName: "NL F1 Weekend",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NL F1 Weekend",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  alternates: {
    canonical: "https://amsterdam-zandvoort-navigator.mowlsint.chatgpt.site",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "https://amsterdam-zandvoort-navigator.mowlsint.chatgpt.site",
    siteName: "NL F1 Weekend",
    title: "Amsterdam × Zandvoort 2026",
    description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Amsterdam und die Rennstrecke von Zandvoort" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amsterdam × Zandvoort 2026",
    description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
    apple: "/app-icon-180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#172536",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
