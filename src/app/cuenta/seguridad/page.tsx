"use client";

import { useEffect, useState } from "react";

function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    return r.text().then((txt) => {
        const status = r.status;
        if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
        try {
            const json = JSON.parse(txt);
            return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status };
        } catch {
            return { ok: r.ok, data: null, error: r.ok ? null : txt, status };
        }
    });
}

function formatDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("es-AR", { dateStyle: "full", timeStyle: "short" });
}

export default function SeguridadPage() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string>("");
    const [meta, setMeta] = useState<{ canChange: boolean; nextAllowedChange: string | null } | null>(null);

    const loadMeta = async () => {
        const r = await fetch("/api/auth/password-meta");
        const { ok, data, error } = await safeJson<{ canChange: boolean; nextAllowedChange: string }>(r);
        if (!ok) {
            setMsg(error ?? "No se pudo leer la información de seguridad");
            return;
        }
        setMeta({ canChange: data?.canChange ?? false, nextAllowedChange: data?.nextAllowedChange ?? null });
    };

    useEffect(() => {
        loadMeta().catch(() => { });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg("");
        if (newPassword !== confirmPassword) {
            setMsg("La contraseña nueva y su confirmación no coinciden");
            return;
        }
        setLoading(true);
        const r = await fetch("/api/auth/cambiar-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const { ok, data, error } = await safeJson<{ nextAllowedChange?: string }>(r);
        if (!ok) {
            setMsg(error ?? "No se pudo actualizar la contraseña");
        } else {
            setMsg("Contraseña actualizada. Recordá que no podrás volver a cambiarla durante los próximos 7 días.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setMeta({ canChange: false, nextAllowedChange: data?.nextAllowedChange ?? null });
        }
        setLoading(false);
    };

    const blockedMessage = meta?.nextAllowedChange && !meta?.canChange
        ? `Podrás volver a cambiar tu contraseña a partir del ${formatDate(meta.nextAllowedChange)}.`
        : "";

    return (
        <div className="space-y-6">
            <h1 className="h1">Seguridad de la cuenta</h1>
            {msg && <div className="card bg-chip-bg/50 text-sm">{msg}</div>}

            <section className="card max-w-2xl">
                <h2 className="h2">Cambiar contraseña</h2>
                <p className="text-sm text-muted mt-1">
                    Por seguridad, solo se puede modificar la contraseña una vez cada 7 días.
                </p>
                {blockedMessage && (
                    <p className="text-sm text-muted mt-2">{blockedMessage}</p>
                )}

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Contraseña actual</label>
                        <input
                            type="password"
                            className="input mt-1"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Nueva contraseña</label>
                        <input
                            type="password"
                            className="input mt-1"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            minLength={6}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Confirmar nueva contraseña</label>
                        <input
                            type="password"
                            className="input mt-1"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            minLength={6}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || meta?.canChange === false}
                    >
                        {loading ? "Actualizando..." : "Guardar nueva contraseña"}
                    </button>
                </form>
            </section>
        </div>
    );
}
