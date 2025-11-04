// src/components/Header.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
    { href: "/recepcion", label: "Recepción" },
    { href: "/pagos", label: "Pagos" },
];

export default function Header() {
    const pathname = usePathname();

    return (
        <header className="backdrop-blur border-b" style={{ borderColor: "var(--card-border)" }}>
            <div className="container-app py-3 flex items-center gap-4">
                <Link href="/" aria-label="Ir al inicio">
                    <Image
                        src="/zenit-logo@2x.png"
                        alt="Zenit"
                        width={72}
                        height={72}
                        priority
                    />
                </Link>

                <div className="leading-tight">
                    <div className="text-[18px] sm:text-[20px] font-semibold">Sistema de turnos</div>
                </div>

                <nav className="ml-auto flex items-center gap-1">
                    {nav.map((item) => {
                        const active = pathname?.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-3 py-2 rounded-xl text-sm transition ${active ? "bg-(--chip-bg)" : "hover:bg-(--chip-bg)"}`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
