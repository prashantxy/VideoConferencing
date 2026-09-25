import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { IntroLoader } from "@/components/Loader";

// Apple platforms render SF Pro via the system stack; Inter is the fallback elsewhere.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vibecall.world"),
  title: "VibeCall",
  description: "One-on-one video conversations with someone new, peer to peer over WebRTC.",
};

export const viewport: Viewport = {
  themeColor: "#050506",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Decide before first paint whether the intro plays (once per session, never on a call). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add('js');try{var seen=sessionStorage.getItem('vm-intro');d.dataset.intro=(seen||location.pathname.indexOf('/Room')===0)?'done':'play'}catch(e){d.dataset.intro='done'}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <IntroLoader />
        {children}
      </body>
    </html>
  );
}
