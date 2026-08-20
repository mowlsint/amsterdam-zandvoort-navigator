import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://amsterdam-zandvoort-navigator.mowlsint.chatgpt.site";
const socialImageUrl = new URL(`${basePath}/og.png`, new URL(siteUrl).origin).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Amsterdam × Zandvoort 2026",
  description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix in Zandvoort.",
  applicationName: "NL F1 Weekend",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "NL F1 Weekend",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: siteUrl,
    siteName: "NL F1 Weekend",
    title: "Amsterdam × Zandvoort 2026",
    description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix.",
    images: [{ url: socialImageUrl, width: 1200, height: 630, alt: "Amsterdam und die Rennstrecke von Zandvoort" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amsterdam × Zandvoort 2026",
    description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix.",
    images: [socialImageUrl],
  },
  icons: {
    icon: `${basePath}/app-icon.svg`,
    shortcut: `${basePath}/app-icon.svg`,
    apple: `${basePath}/app-icon-180.png`,
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
