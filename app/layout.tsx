import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movies.snishad Backend & Admin API",
  description: "High performance, CORS-enabled entertainment backend and cinema content engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body
        className="font-sans bg-[#0b0f17] text-slate-100 antialiased min-h-screen selection:bg-[#e50914]/20 selection:text-[#ff1f2d]"
      >
        {children}
      </body>
    </html>
  );
}
