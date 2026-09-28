import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Async Queue",
  description: "Minimal operations dashboard for the async queue.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
