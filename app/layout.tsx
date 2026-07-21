import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aphrodite — your occasion concierge",
  description:
    "Tell Aphrodite the occasion. It reads your skin and your colors, then plans your skincare countdown and renders your outfit — all from one selfie, powered by YouCam AI.",
  openGraph: {
    title: "Aphrodite — your occasion concierge",
    description:
      "One selfie → a skincare countdown and a rendered outfit for your occasion, powered by YouCam AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
