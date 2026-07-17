import type { Metadata } from "next";
import "../index.css";
import { AppProviders } from "@/components/AppProviders";

export const metadata: Metadata = {
    title: "Test Craft",
    description: "Practice all academic modules with integrated scoring and AI-assisted feedback.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
