import type { Metadata } from "next";
import "../index.css";
import { AppProviders } from "@/components/AppProviders";

export const metadata: Metadata = {
  title: "IELTS Ace Pro",
  description: "Practice all IELTS Academic modules with integrated scoring and AI-assisted feedback.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
