import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Hogan's Playground",
  description: "Private market notebook, trade lab, and research workspace",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
