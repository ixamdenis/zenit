"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image"; // <-- Importamos Image

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        if (!email || !password) {
            setMsg("Completa tu email y contraseña.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setMsg(data.error || "Email o contraseña incorrectos.");
            } else {
                // ¡Éxito! Redirigimos a la raíz.
                // La raíz ("/") se encargará de llevar al usuario
                // a su panel correcto (Recepción, Profesional, etc.)
                router.push("/");
            }
        } catch (error) {
            setMsg("Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto pt-12">
            {/* --- INICIO: Logo Agregado --- */}
            <Link href="/" className="flex justify-center mb-6" aria-label="Ir al inicio">
                <Image
                    src="/zenit-logo@2x.png"
                    alt="Zenit"
                    width={80}
                    height={80}
                    className="w-20 h-auto"
                    priority
                />
            </Link>
            {/* --- FIN: Logo Agregado --- */}

            <div className="card">
                <h1 className="h1 mb-4 text-center">Iniciar Sesión</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input mt-1"
                            placeholder="juan@correo.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input mt-1"
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary w-full">
                        {loading ? "Ingresando..." : "Ingresar"}
                    </button>
                </form>

                {msg && (
                    <div className="mt-4 text-center text-sm text-red-600">
                        {msg}
                    </div>
                )}

                <div className="mt-6 text-center text-sm">
                    ¿No tienes una cuenta?{" "}
                    <Link href="/register" className="text-brand-primary hover:underline">
                        Regístrate aquí
                    </Link>
                </div>
            </div>
        </div>
    );
}