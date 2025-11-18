"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CambiarPasswordPage() {
    const router = useRouter();
    const [pass, setPass] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        const r = await fetch("/api/auth/cambiar-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: pass })
        });
        const data = await r.json();

        if (r.ok) {
            alert("Contraseña actualizada. Ya puedes usar el sistema.");
            router.push("/"); // Volver al inicio
            router.refresh(); // Refrescar para que el middleware note el cambio
        } else {
            setMsg(data.error || "Error al actualizar");
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 card border-brand-primary">
            <h1 className="h1 text-center mb-4">Bienvenido a Zenit</h1>
            <p className="text-center text-muted mb-6">
                Es tu primer ingreso (o tu contraseña fue reseteada).<br />
                Por favor, <strong>crea una nueva contraseña</strong> para continuar.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Nueva Contraseña</label>
                    <input
                        type="password"
                        className="input mt-1"
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                    />
                </div>
                <button disabled={loading || pass.length < 6} className="btn btn-primary w-full">
                    {loading ? "Guardando..." : "Establecer Contraseña"}
                </button>
            </form>
            {msg && <div className="mt-4 text-red-600 text-center">{msg}</div>}
        </div>
    );
}