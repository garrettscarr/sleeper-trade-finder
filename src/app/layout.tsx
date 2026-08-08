import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { SessionRestore } from "@/components/SessionRestore";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sleeper Trade Finder",
  description:
    "League trade finder that matches deals using your league mates' personal values. Invite codes unlock a device — no accounts or passwords.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <SessionRestore />
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
