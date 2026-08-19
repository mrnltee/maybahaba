import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MayBahaBa — May baha ba?",
  description:
    "Simpleng alerto para sa biyahero. Crowdsourced na kondisyon ng baha sa Metro Manila — alamin bago bumiyahe.",
  applicationName: "MayBahaBa",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-mark.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MayBahaBa — May baha ba?",
    description: "Simpleng alerto para sa biyahero.",
    siteName: "MayBahaBa",
    locale: "fil_PH",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E3A8A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-(--color-paper) text-(--color-ink)">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
