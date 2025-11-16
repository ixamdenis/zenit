"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionPayload } from "@/lib/session"; // Importamos la sesión

// Usamos los mismos tipos que ya definimos en Recepción
// En un futuro, podríamos moverlos a un archivo types.ts compartido
type ListResp = {
    date: string; count: number;
    appointments: {
        id: string; estado: string; startAt: string; endAt: string;
        serviceId: string; serviceName: string; roomId: string | null; roomName: string | null;
        patientId: string; professionalId: string; patientName: string; professionalName: string;
    }[];
    error?: string;
};

// --- Helpers (copiados de Recepción) ---
async function safeJson<T = any>(r: Response) {
    const status = r.status;
    const txt = await r.text();
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `HTTP ${status}` };
    try {
        const json = JSON.parse(txt);
        return { ok: r.ok, data: json as T, error: r.ok ? null : (json as any)?.error };
    } catch {
        return { ok: r.ok, data: null, error: txt };
    }
}
function toYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}
// --- Fin Helpers ---


export default function ProfesionalAgendaPage() {
    const todayISO = useMemo(() => toYMD(new Date()), []);
    const [date, setDate] = useState<string>(todayISO);
    const [list, setList] = useState<ListResp | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [msg, setMsg] = useState<string>("");

    // Guardaremos la sesión del profesional aquí
    const [session, setSession] = useState<SessionPayload | null>(null);
    const [loadingSession, setLoadingSession] = useState(true);

    // 1. Cargar los datos de la sesión del profesional
    useEffect(() => {
        fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setSession(data.user);
                } else {
                    setMsg("No se pudo cargar la información del profesional.");
                }
            })
            .finally(() => setLoadingSession(false));
    }, []);

    // 2. Cargar la lista de turnos
    const loadList = async (professionalEmail: string) => {
        if (!professionalEmail) return; // No cargar si aún no tenemos el email

        setLoadingList(true);

        // Usamos la misma API de 'list', pero forzamos el email del profesional
        const qs = new URLSearchParams({
            date,
            professionalEmail: professionalEmail
        });

        const r = await fetch(`/api/appointments/list?${qs.toString()}`);
        const { ok, data, error } = await safeJson<ListResp>(r);

        if (!ok) setMsg(error ?? "Error al listar turnos");
        else setList(data as ListResp);

        setLoadingList(false);
    };

    // 3. Recargar la lista cuando cambia la fecha O cuando se carga la sesión
    useEffect(() => {
        if (session?.email) {
            loadList(session.email).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, session]); // Depende de 'date' y 'session'

    if (loadingSession) {
        return <div className="text-center p-8">Cargando...</div>
    }

    return (
        <div className="space-y-6">
            <h1 className="h1">Mi Agenda</h1>

            {/* Filtro de Fecha */}
            <section className="card">
                <h2 className="h2">Ver día</h2>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium">Fecha</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="input mt-1"
                        />
                    </div>
                    <div>
                        <button
                            onClick={() => loadList(session!.email)}
                            className="btn btn-outline"
                            disabled={loadingList || !session?.email}
                        >
                            {loadingList ? "Actualizando..." : "Actualizar"}
                        </button>
                    </div>
                </div>
            </section>

            {/* Lista del día */}
            <section className="space-y-3">
                <h2 className="h2">Turnos del día ({list?.count ?? 0})</h2>

                {loadingList && !list ? (
                    <p className="text-sm text-muted">Cargando turnos...</p>
                ) : !list?.appointments?.length ? (
                    <p className="text-sm text-muted">No tienes turnos para este día.</p>
                ) : (
                    list.appointments.map((a) => {
                        const start = new Date(a.startAt);
                        const end = new Date(a.endAt);
                        const h1 = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
                        const h2 = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

                        return (
                            <div key={a.id} className="card">
                                <div>
                                    <div className="font-medium">
                                        {h1}–{h2} · {a.serviceName} {a.roomName ? `· ${a.roomName}` : ""}
                                    </div>
                                    <div className="text-sm text-muted">
                                        Paciente: {a.patientName || "—"}
                                    </div>
                                    <div className={`text-sm font-semibold ${a.estado === "CONFIRMADO" ? "text-green-600" :
                                            a.estado === "RESERVADO" ? "text-blue-600" :
                                                a.estado === "CANCELADO" ? "text-red-600" : ""
                                        }`}>
                                        Estado: {a.estado}
                                    </div>
                                </div>
                                {/* Más adelante podríamos agregar botones de "Ver detalle" o "Marcar asistencia" aquí */}
                            </div>
                        );
                    })
                )}
            </section>

            {msg ? <div className="card bg-brand-warn/20 border-brand">{msg}</div> : null}
        </div>
    );
}