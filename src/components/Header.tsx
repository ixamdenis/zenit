// src/components/Header.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionPayload } from "@/lib/session";

function useSession() {
    const [session, setSession] = useState<SessionPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.user) {
                    setSession(data.user);
                }
            })
            .catch(() => setSession(null))
            .finally(() => setLoading(false));
    }, []);

    return { session, loading };
}

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { session, loading } = useSession();

    if (pathname === "/login" || pathname === "/register") {
        return null;
    }

    const handleLogout = async () => {
        if (!window.confirm("¿Seguro que quieres cerrar sesión?")) return;
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    };

    // --- NAVEGACIÓN ACTUALIZADA ---
    const nav = [
        // Rutas de Recepción
        { href: "/recepcion", label: "Recepción", roles: ["ADMIN", "RECEPCION"] },
        { href: "/pagos", label: "Pagos", roles: ["ADMIN", "RECEPCION"] },
        // Ruta de Profesional
        { href: "/profesional/agenda", label: "Mi Agenda", roles: ["PROFESIONAL"] },
    ];

    // Filtramos la navegación según el rol del usuario
    const allowedNav = nav.filter(item =>
        session?.role && item.roles.includes(session.role as any)
    );

    return (
        <header className="backdrop-blur border-b" style={{ borderColor: "var(--card-border)" }}>
            <div className="container-app py-3 flex items-center gap-4">
                <Link href="/" aria-label="Ir al inicio">
                    <Image
                        src="/zenit-logo@2x.png"
                        alt="Zenit"
                        width={72}
                        height={72}
                        className="w-[50px] h-auto"
                        priority
                    />
                </Link>

                <div className="leading-tight">
                    <div className="text-[18px] sm:text-[20px] font-semibold">Sistema de turnos</div>
                </div>

                {/* Navegación y Menú de Usuario */}
                <div className="ml-auto flex items-center gap-2 sm:gap-4">
                    <nav className="flex items-center gap-1">
                        {!loading && session && allowedNav.map((item) => {
                            const active = pathname?.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-3 py-2 rounded-xl text-sm transition ${active ? "bg-chip-bg font-medium" : "hover:bg-chip-bg"
                                        } hidden sm:block`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Menú de Usuario */}
                    {!loading && (
                        <div className="flex items-center gap-2">
                            {session ? (
                                <>
                                    <span className="text-sm hidden sm:block">
                                        Hola, <strong>{session.nombre}</strong>
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        className="btn btn-outline text-sm"
                                    >
                                        Salir
                                    </button>
                                </>
                            ) : (
                                <Link href="/login" className="btn btn-primary text-sm">
                                    Ingresar
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}