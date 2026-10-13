import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "TicketFlow — Discover, book, walk in",
  description:
    "Event ticketing marketplace: discover live events, reserve tickets with atomic inventory holds, get signed digital QR passes, and check in seamlessly.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </head>
      <body className={`${fontSans.className} bg-[#fafafa] text-zinc-900 flex min-h-[100dvh] flex-col antialiased text-base`}>
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-zinc-200/80 bg-white py-14 text-sm text-zinc-600 no-print">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-zinc-100">
              <div className="space-y-2">
                <div className="flex items-center gap-3 font-extrabold tracking-tight text-zinc-900 text-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.webp"
                    alt="TicketFlow"
                    className="h-8 w-8 object-contain rounded-lg shadow-xs"
                  />
                  TicketFlow
                </div>
                <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
                  Real-time event marketplace with atomic inventory holds, verified organizers, and cryptographic QR check-in.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-7 text-sm font-semibold text-zinc-600">
                <Link href="/browse" className="hover:text-zinc-900 transition">Browse Events</Link>
                <Link href="/organizer/onboarding" className="hover:text-zinc-900 transition">Host an Event</Link>
                <Link href="/login" className="hover:text-zinc-900 transition">Sign In</Link>
                <Link href="/terms" className="hover:text-zinc-900 transition">Terms of Service</Link>
                <Link href="/privacy" className="hover:text-zinc-900 transition">Privacy Policy</Link>
              </div>
            </div>
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-zinc-500">
              <p>© {new Date().getFullYear()} TicketFlow Technologies. All rights reserved.</p>
              <p className="flex items-center gap-2 font-medium">
                <span className="inline-block h-2 w-2 bg-zinc-900 shrink-0" />
                Systems operational · 127.0.0.1:5434
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
