import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TicketFlow — Discover, book, walk in",
  description:
    "Event ticketing marketplace: discover events, book tickets with live availability, get QR passes, and run check-ins.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎟️</text></svg>",
  },
};

const themeInit = `(() => {
  try {
    const s = localStorage.getItem("theme");
    const d = s === "dark" || (s !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", d);
  } catch {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={inter.className}>
        <SiteHeader />
        <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 pb-16 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
