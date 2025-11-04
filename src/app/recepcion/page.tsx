"use client";

import { useEffect, useMemo, useState } from "react";

type DumpData = {
    professionals: { professionalId: string; nombre: string; apellido: string; userEmail: string }[];
    patients: { patientId: string; nombre: string; apellido: string; userEmail: string }[];
    services: { serviceId: string; nombre: string; duracionMin: number; precioBase: number }[];
    rooms: { roomId: string; nombre: string }[];
};
type SlotsResp = { slots: string[]; professionalId?: string; error?: string };
type ListResp = {
    date: string; count: number;
    appointments: {
        id: string; estado: string; startAt: string; endAt: string;
        serviceId: string; serviceName: string; roomId: string | null; roomName: string | null;
        patientId: string; professionalId: string; patientName: string; professionalName: string;
    }[];
    error?: string;
};

async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}
function toYMD(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }

export default function RecepcionPage() {
    const todayISO = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return toYMD(d); }, []);
    const [dump, setDump] = useState<DumpData | null>(null);
    const [date, setDate] = useState<string>(todayISO);
    const [professionalEmail, setProfessionalEmail] = useState<string>("");
    const [patientEmail, setPatientEmail] = useState<string>("");
    const [serviceName, setServiceName] = useState<string>("Consulta");
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string>("");
    const [list, setList] = useState<ListResp | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [loadingList, setLoadingList] = useState(false);
    const [creating, setCreating] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // Reprogramación
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string>("");
    const [editSlots, setEditSlots] = useState<Record<string, string[]>>({});
    const [editSelected, setEditSelected] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState<string>("");

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/debug/dump");
            const { ok, data, error } = await safeJson<DumpData & { error?: string }>(r);
            if (!ok) { setMsg(error ?? "Error cargando datos iniciales"); return; }
            const j = data as DumpData;
            setDump(j);
            if (j.professionals?.[0]) setProfessionalEmail(j.professionals[0].userEmail);
            if (j.patients?.[0]) setPatientEmail(j.patients[0].userEmail);
            if (j.services?.[0]) setServiceName(j.services[0].nombre);
        })().catch(() => { });
    }, []);

    const loadList = async () => {
        setLoadingList(true);
        const qs = new URLSearchParams({ date });
        if (professionalEmail) qs.set("professionalEmail", professionalEmail);
        const r = await fetch(`/api/appointments/list?${qs.toString()}`);
        const { ok, data, error } = await safeJson<ListResp>(r);
        if (!ok) setMsg(error ?? "Error al listar turnos");
        else setList(data as ListResp);
        setLoadingList(false);
    };

    useEffect(() => { loadList().catch(() => { }); /* eslint-disable-next-line */ }, [date, professionalEmail]);

    const loadSlots = async () => {
        if (!date || !professionalEmail) { setSlots([]); return; }
        setLoadingSlots(true);
        const qs = new URLSearchParams({ date, professionalEmail });
        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { ok, data, error } = await safeJson<SlotsResp>(r);
        if (!ok) { setMsg(error ?? "Error obteniendo disponibilidad"); setSlots([]); }
        else setSlots((data as SlotsResp)?.slots ?? []);
        setLoadingSlots(false);
    };

    useEffect(() => { setSelectedSlot(""); loadSlots().catch(() => { }); /* eslint-disable-next-line */ }, [date, professionalEmail, serviceName]);

    const createAppointment = async () => {
        setMsg("");
        if (!patientEmail || !professionalEmail || !serviceName || !selectedSlot) {
            setMsg("Completá todos los campos y elegí un horario."); return;
        }
        setCreating(true);
        const r = await fetch("/api/appointments", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientEmail, professionalEmail, serviceName, startAtISO: selectedSlot })
        });
        const { ok, error, status } = await safeJson<any>(r);
        if (!ok) setMsg(error ?? `Error creando turno (HTTP ${status})`);
        else { setMsg("Turno creado correctamente."); setSelectedSlot(""); await loadList(); await loadSlots(); }
        setCreating(false);
    };

    const cancelAppointment = async (id: string) => {
        setMsg("");
        if (!window.confirm("¿Confirmás cancelar el turno?")) return;
        setCancellingId(id);
        const r = await fetch("/api/appointments/cancel", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: id, whoUserId: "recepcion", reason: "Anulado desde recepción", isAdmin: false })
        });
        const { ok, data, error, status } = await safeJson<any>(r);
        if (!ok) setMsg(error ?? `Error cancelando turno (HTTP ${status})`);
        else {
            const penalty = data?.penalty?.penalidadMonto;
            setMsg(`Turno cancelado.${typeof penalty === "number" ? ` Penalidad estimada: $${penalty}` : ""}`);
            await loadList(); await loadSlots();
        }
        setCancellingId(null);
    };

    const startEdit = async (a: ListResp["appointments"][number]) => {
        setMsg("");
        setEditingId(a.id);
        const cur = new Date(a.startAt); cur.setHours(0, 0, 0, 0);
        setEditDate(toYMD(cur));
        await loadEditSlots(a, toYMD(cur));
    };
    const loadEditSlots = async (a: ListResp["appointments"][number], ymd: string) => {
        const qs = new URLSearchParams({ date: ymd, professionalId: a.professionalId, ignoreAppointmentId: a.id });
        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { ok, data, error } = await safeJson<SlotsResp>(r);
        if (!ok) { setMsg(error ?? "Error cargando horarios para reprogramar"); return; }
        const s = (data as SlotsResp)?.slots ?? [];
        setEditSlots(prev => ({ ...prev, [a.id]: s }));
        setEditSelected(prev => ({ ...prev, [a.id]: "" }));
    };
    const onChangeEditDate = async (a: ListResp["appointments"][number], ymd: string) => {
        setEditDate(ymd);
        await loadEditSlots(a, ymd);
    };
    const saveEdit = async (a: ListResp["appointments"][number]) => {
        const pick = editSelected[a.id];
        if (!pick) { setMsg("Elegí un horario nuevo para reprogramar."); return; }
        const d = new Date(pick); const hh = String(d.getHours()).padStart(2, "0"); const mm = String(d.getMinutes()).padStart(2, "0"); const ymd = toYMD(d);
        if (!window.confirm(`¿Confirmás reprogramar el turno a ${ymd} ${hh}:${mm}?`)) return;

        const r = await fetch("/api/appointments/reschedule", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: a.id, newStartISO: pick })
        });
        const { ok, data, error, status } = await safeJson<any>(r);
        if (!ok) { setMsg(error ?? `Error reprogramando (HTTP ${status})`); return; }
        const total = data?.charge?.amountTotal ?? 0; const serviceAmt = data?.charge?.amountService ?? 0; const penaltyAmt = data?.charge?.amountPenalty ?? 0;
        setMsg(`Turno reprogramado. A cobrar: $${total} (servicio $${serviceAmt}${penaltyAmt ? ` + penalidad $${penaltyAmt}` : ""}).`);
        setEditingId(null);
        await loadList(); await loadSlots();
    };
    const cancelEdit = () => { setEditingId(null); };

    return (
        <div className="space-y-6">
            <h1 className="h1">Recepción <span className="badge ml-2">Zenit</span></h1>

            {/* Filtros */}
            <section className="card">
                <h2 className="h2">Filtros</h2>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Fecha</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Profesional</label>
                        <select className="input mt-1" value={professionalEmail} onChange={(e) => setProfessionalEmail(e.target.value)}>
                            <option value="">-- Elegir profesional --</option>
                            {dump?.professionals?.map((p) => (
                                <option key={p.professionalId} value={p.userEmail}>
                                    {p.apellido}, {p.nombre} ({p.userEmail})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Servicio</label>
                        <select className="input mt-1" value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
                            {dump?.services?.map((s) => (
                                <option key={s.serviceId} value={s.nombre}>
                                    {s.nombre} ({s.duracionMin} min)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* Crear turno */}
            <section className="card">
                <h2 className="h2">Crear turno</h2>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Paciente</label>
                        <select className="input mt-1" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)}>
                            <option value="">-- Elegir paciente --</option>
                            {dump?.patients?.map((p) => (
                                <option key={p.patientId} value={p.userEmail}>
                                    {p.apellido}, {p.nombre} ({p.userEmail})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Horarios disponibles</label>
                        <select className="input mt-1" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} disabled={loadingSlots || !slots.length}>
                            <option value="">{loadingSlots ? "Cargando..." : slots.length ? "-- Elegir horario --" : "Sin disponibilidad"}</option>
                            {slots.map((iso) => {
                                const d = new Date(iso); const hh = String(d.getHours()).padStart(2, "0"); const mm = String(d.getMinutes()).padStart(2, "0");
                                return <option key={iso} value={iso}>{hh}:{mm}</option>;
                            })}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button onClick={createAppointment} disabled={creating} className="btn btn-primary w-full">
                            {creating ? "Creando..." : "Crear turno"}
                        </button>
                    </div>
                </div>
            </section>

            {/* Lista del día */}
            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <h2 className="h2">Turnos del día</h2>
                    <button onClick={loadList} className="btn btn-outline text-sm" disabled={loadingList}>
                        {loadingList ? "Actualizando..." : "Actualizar"}
                    </button>
                </div>

                {!list?.appointments?.length ? (
                    <p className="text-sm text-muted">No hay turnos para la selección actual.</p>
                ) : (
                    list.appointments.map((a) => {
                        const start = new Date(a.startAt); const end = new Date(a.endAt);
                        const h1 = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
                        const h2 = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
                        const isEditing = editingId === a.id;
                        const localSlots = editSlots[a.id] ?? [];

                        return (
                            <div key={a.id} className="card">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium">
                                            {h1}–{h2} · {a.serviceName} {a.roomName ? `· ${a.roomName}` : ""}
                                        </div>
                                        <div className="text-sm text-muted">
                                            Paciente: {a.patientName || "—"} — Profesional: {a.professionalName || "—"}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => cancelAppointment(a.id)} className="btn btn-outline text-sm">Cancelar</button>
                                        <button onClick={() => startEdit(a)} className="btn btn-outline text-sm">Reprogramar</button>
                                    </div>
                                </div>

                                {isEditing && (
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium">Nuevo día</label>
                                            <input type="date" value={editDate} onChange={(e) => onChangeEditDate(a, e.target.value)} className="input mt-1" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Nuevo horario</label>
                                            <select
                                                className="input mt-1"
                                                value={editSelected[a.id] ?? ""}
                                                onChange={(e) => setEditSelected(prev => ({ ...prev, [a.id]: e.target.value }))}
                                            >
                                                <option value="">{localSlots.length ? "-- Elegir horario --" : "Sin disponibilidad"}</option>
                                                {localSlots.map((iso) => {
                                                    const d = new Date(iso); const hh = String(d.getHours()).padStart(2, "0"); const mm = String(d.getMinutes()).padStart(2, "0");
                                                    return <option key={iso} value={iso}>{hh}:{mm}</option>;
                                                })}
                                            </select>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <button onClick={() => saveEdit(a)} className="btn btn-primary">Guardar</button>
                                            <button onClick={() => cancelEdit()} className="btn btn-outline">Cerrar</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </section>

            {msg ? <div className="card bg-(--brand-warn)/20 border-brand">{msg}</div> : null}
        </div>
    );
}
