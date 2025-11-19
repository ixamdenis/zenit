"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MiPerfilPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    const [form, setForm] = useState({
        nombre: "",
        apellido: "",
        dni: "",
        email: "", // Solo lectura
        telefono: "",
        localidad: "",
        tieneObraSocial: false,
        obraSocialNombre: "",
        telefonoEmergencia: "" // Nuevo campo
    });

    useEffect(() => {
        fetch("/api/paciente/perfil")
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    setMsg(data.error);
                } else {
                    setForm({
                        nombre: data.nombre,
                        apellido: data.apellido,
                        dni: data.dni || "",
                        email: data.email,
                        telefono: data.telefono || "",
                        localidad: data.localidad || "",
                        tieneObraSocial: data.tieneObraSocial || false,
                        obraSocialNombre: data.obraSocialNombre || "",
                        telefonoEmergencia: data.telefonoEmergencia || ""
                    });
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMsg("");

        try {
            const r = await fetch("/api/paciente/perfil", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    telefono: form.telefono,
                    localidad: form.localidad,
                    tieneObraSocial: form.tieneObraSocial,
                    obraSocialNombre: form.obraSocialNombre,
                    telefonoEmergencia: form.telefonoEmergencia
                })
            });
            const data = await r.json();
            if (data.ok) setMsg("Perfil actualizado correctamente.");
            else setMsg(data.error || "Error al guardar.");
        } catch (e) {
            setMsg("Error de conexión.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando perfil...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="h1">Mi Perfil</h1>
                <button onClick={() => router.back()} className="btn btn-outline text-sm">Volver</button>
            </div>

            {msg && <div className={`card p-3 ${msg.includes("Error") ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{msg}</div>}

            <form onSubmit={handleSubmit} className="card space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Campos de Solo Lectura (Identidad) */}
                    <div>
                        <label className="block text-sm font-medium text-muted">Nombre</label>
                        <input className="input mt-1 bg-gray-100" value={form.nombre} disabled />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted">Apellido</label>
                        <input className="input mt-1 bg-gray-100" value={form.apellido} disabled />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted">DNI</label>
                        <input className="input mt-1 bg-gray-100" value={form.dni} disabled />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted">Email / Usuario</label>
                        <input className="input mt-1 bg-gray-100" value={form.email} disabled />
                    </div>
                </div>

                <hr className="border-gray-100 my-4" />
                <h2 className="text-lg font-semibold text-brand-primary">Datos Editables</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Teléfono / WhatsApp</label>
                        <input
                            className="input mt-1"
                            value={form.telefono}
                            onChange={e => setForm({ ...form, telefono: e.target.value })}
                            placeholder="Ej: 2920..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Localidad</label>
                        <input
                            className="input mt-1"
                            value={form.localidad}
                            onChange={e => setForm({ ...form, localidad: e.target.value })}
                        />
                    </div>
                </div>

                {/* Campo de emergencia destacado */}
                <div className="grid grid-cols-1">
                    <div>
                        <label className="block text-sm font-bold text-red-700">Teléfono de Emergencia</label>
                        <input
                            className="input mt-1 border-red-100 focus:border-red-300"
                            value={form.telefonoEmergencia}
                            onChange={e => setForm({ ...form, telefonoEmergencia: e.target.value })}
                            placeholder="Número de familiar o allegado"
                        />
                        <p className="text-xs text-muted mt-1">A quién llamar en caso de urgencia.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                    <input
                        type="checkbox"
                        id="osCheck"
                        checked={form.tieneObraSocial}
                        onChange={(e) => setForm({ ...form, tieneObraSocial: e.target.checked })}
                        className="h-4 w-4 rounded"
                    />
                    <label htmlFor="osCheck" className="text-sm font-medium">Tengo Obra Social / Prepaga</label>
                </div>

                {form.tieneObraSocial && (
                    <div>
                        <label className="block text-sm font-medium">Nombre de la Obra Social</label>
                        <input
                            type="text"
                            value={form.obraSocialNombre}
                            onChange={(e) => setForm({ ...form, obraSocialNombre: e.target.value })}
                            className="input mt-1"
                            placeholder="Ej: IPROSS, OSDE, ETC"
                        />
                    </div>
                )}

                <div className="pt-4">
                    <button disabled={saving} className="btn btn-primary w-full">
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </form>
        </div>
    );
}