"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Professional = {
    id: string; // ID del ProfessionalProfile
    nombre: string;
    apellido: string;
    especialidad: string | null;
    email: string;
    aliasBancario: string | null;
};
type Service = { id: string; nombre: string; duracionMin: number; precioBase: number };
type SlotsResp = { slots: string[]; error?: string };

async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}
function toYMD(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }
function fmtDate(iso: string) { if (!iso) return ""; const d = new Date(iso); const dia = String(d.getDate()).padStart(2, "0"); const mes = String(d.getMonth() + 1).padStart(2, "0"); const h = String(d.getHours()).padStart(2, "0"); const m = String(d.getMinutes()).padStart(2, "0"); return `${dia}/${mes} ${h}:${m}`; }


export default function SolicitarTurnoPage() {
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [loadingPros, setLoadingPros] = useState(true);

    // 1. Cargar Profesionales
    useEffect(() => {
        fetch("/api/paciente/profesionales")
            .then(r => r.json())
            .then(data => {
                setProfessionals(data.professionals ?? []);
            })
            .finally(() => setLoadingPros(false));
    }, []);

    // --- SE ELIMINA LA LÓGICA DE RESERVA AQUÍ ---

    if (loadingPros) return <div className="text-center p-8">Cargando...</div>;

    // Se reemplaza el formulario de 4 pasos por la lista de profesionales con enlace a su perfil
    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <h1 className="h1">Solicitar Turno</h1>
            <div className="card space-y-4">
                <h2 className="h2">Elegir Profesional</h2>
                <div className="space-y-3">
                    {professionals.map((p) => (
                        <div key={p.id} className="card p-3 flex justify-between items-center">
                            <div>
                                <p className="font-medium">{p.apellido}, {p.nombre}</p>
                                <p className="text-sm text-muted">{p.especialidad}</p>
                            </div>
                            <Link
                                href={`/paciente/profesional/${p.id}`} // <--- CAMBIO CLAVE
                                className="btn btn-primary text-sm"
                            >
                                Ver Perfil y Reservar
                            </Link>
                        </div>
                    ))}
                </div>
                {professionals.length === 0 && <p className="text-muted text-sm">No hay profesionales disponibles para reserva.</p>}
            </div>
        </div>
    );
}