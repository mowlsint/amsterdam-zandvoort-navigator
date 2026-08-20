import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amsterdam × Zandvoort 2026",
  description: "Der ruhige Wochenend-Navigator für Amsterdam und den Dutch Grand Prix in Zandvoort.",
  applicationName: "NL F1 Weekend",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
    apple: "/app-icon-180.png",
  },
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
