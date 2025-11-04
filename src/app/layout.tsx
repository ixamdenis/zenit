// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Poppins, Crimson_Pro } from "next/font/google";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-poppins",
    display: "swap",
});

const crimson = Crimson_Pro({
    subsets: ["latin"],
    weight: ["400", "600", "700"],
    variable: "--font-crimson",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Zenit – Agenda",
    description: "Sistema de turnos Zenit (MVP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={`${poppins.variable} ${crimson.variable} font-sans`}>
                <Header />
                <main className="container-app py-6">{children}</main>
                <footer
                    className="mt-10 border-t"
                    style={{ borderColor: "var(--card-border)" }}
                >
                    <div className="container-app py-4 text-xs text-muted">
                        © {new Date().getFullYear()} Zenit — Sistema de turnos
                    </div>
                </footer>
            </body>
        </html>
    );
}
