import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import "./globals.css";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
    variable: "--font-poppins",
    display: "swap",
});

export const metadata: Metadata = {
    title: "IOAuto",
    description: "Micro-saas multi-tenant para operacao automotiva com atendimento humano e publicacao multicanal.",
    icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon.ico",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
            <body className={poppins.variable}>{children}</body>
        </html>
    );
}
