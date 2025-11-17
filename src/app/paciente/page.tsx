"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Tipos
type AppointmentItem = {
    id: string;
    estado: string;
    startAt: string;
    endAt: string;
    serviceName: string;
    roomName: string | null;
    professionalName: string;
    professionalId: string; // <-- Necesario para reprogramar
    paymentId: string | null;
    paymentStatus: "PENDING" | "PAID" | "CANCELED" | null;
};
type SlotsResp = { slots: string[]; error?: string };
type ListResp = { appointments: AppointmentItem[]; error?: string };

// Helpers
async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes} ${h}:${m}`;
}
function toYMD(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }


export default function PacienteDashboardPage() {
    const todayISO = useMemo(() => toYMD(new Date()), []);
    const [list, setList] = useState<AppointmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<string>("");

    // Estados de Cancelación
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [cbu, setCbu] = useState("");

    // Estados de Reprogramación
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string>("");
    const [editSlots, setEditSlots] = useState<string[]>([]);
    const [editSelected, setEditSelected] = useState<string>("");
    const [loadingSlots, setLoadingSlots] = useState(false);

    const loadList = async () => {
        setLoading(true);
        setMsg("");
        const r = await fetch("/api/paciente/mis-turnos");
        const { ok, data, error } = await safeJson<ListResp>(r);
        if (!ok) { setMsg(error ?? "Error al cargar turnos."); setList([]); }
        else { setList(data?.appointments ?? []); }
        setLoading(false);
    };

    useEffect(() => { loadList().catch(() => { }); }, []);

    // --- CANCELAR ---
    const requestCancel = (a: AppointmentItem) => {
        setMsg("");
        setCancellingId(a.id);
        setCbu("");
    };

    const confirmCancel = async (id: string, hoursDiff: number) => {
        const isRefund = hoursDiff >= 24;
        if (isRefund && !cbu.trim()) {
            alert("Por favor ingresa tu Alias/CBU para el reintegro.");
            return;
        }
        if (!window.confirm(isRefund ? "¿Confirmás cancelar? Te reintegraremos la seña." : "¿Confirmás cancelar? Perderás la seña por ser menos de 24hs.")) return;

        const r = await fetch("/api/appointments/cancel", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                appointmentId: id,
                reason: "Cancelado por paciente",
                cbuReintegro: isRefund ? cbu : undefined
            })
        });
        const { ok, data, error } = await safeJson<any>(r);
        if (!ok) setMsg(error ?? "Error al cancelar.");
        else {
            setMsg("Turno cancelado correctamente.");
            await loadList();
        }
        setCancellingId(null);
    };

    // --- REPROGRAMAR ---
    const startEdit = async (a: AppointmentItem) => {
        setMsg("");
        // Validar 24hs antes de abrir el editor (para no ilusionar al usuario)
        const now = new Date();
        const start = new Date(a.startAt);
        const hoursDiff = (start.getTime() - now.getTime()) / 36e5;

        if (hoursDiff < 24) {
            setMsg("Faltan menos de 24hs. No se puede reprogramar, debes cancelar (perdiendo la seña) y sacar uno nuevo.");
            return;
        }

        setEditingId(a.id);
        setEditDate(toYMD(start)); // Inicializar con la fecha actual del turno
        setEditSlots([]);
        setEditSelected("");
        // Cargar slots iniciales
        await loadEditSlots(a.professionalId, toYMD(start), a.id, a.serviceName);
    };

    const loadEditSlots = async (proId: string, ymd: string, ignoreId: string, srvName: string) => {
        setLoadingSlots(true);
        const qs = new URLSearchParams({ date: ymd, professionalId: proId, ignoreAppointmentId: ignoreId, serviceName: srvName });
        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { ok, data } = await safeJson<SlotsResp>(r);
        if (ok) setEditSlots(data?.slots ?? []);
        setLoadingSlots(false);
    };

    const saveEdit = async (a: AppointmentItem) => {
        if (!editSelected) { setMsg("Elige un horario nuevo."); return; }
        if (!window.confirm("¿Confirmás la reprogramación? La seña se mantendrá válida.")) return;

        const r = await fetch("/api/appointments/reschedule", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: a.id, newStartISO: editSelected })
        });
        const { ok, error } = await safeJson<any>(r);
        if (!ok) setMsg(error ?? "Error al reprogramar.");
        else {
            setMsg("Turno reprogramado con éxito.");
            setEditingId(null);
            await loadList();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="h1">Mis Próximos Turnos</h1>
                <Link href="/paciente/solicitar" className="btn btn-primary">Solicitar nuevo turno</Link>
            </div>

            {msg && <div className="card bg-brand-info/20 border-brand-info p-4 text-sm font-medium">{msg}</div>}

            <section className="space-y-4">
                {loading ? (
                    <p className="text-sm text-muted">Cargando...</p>
                ) : !list.length ? (
                    <p className="text-sm text-muted">No tienes turnos próximos.</p>
                ) : (
                    list.map((a) => {
                        const now = new Date();
                        const start = new Date(a.startAt);
                        const hoursDiff = (start.getTime() - now.getTime()) / 36e5;
                        const canReschedule = hoursDiff >= 24;
                        const isEditing = editingId === a.id;
                        const isCancelling = cancellingId === a.id;

                        return (
                            <div key={a.id} className="card border-l-4 border-l-brand-primary">
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    {/* Info */}
                                    <div>
                                        <div className="text-xl font-semibold text-brand-primary">
                                            {fmtDate(a.startAt)}hs
                                        </div>
                                        <div className="text-base font-medium mt-1">
                                            {a.serviceName}
                                        </div>
                                        <div className="text-sm text-muted">
                                            Con: {a.professionalName}
                                        </div>
                                        <div className="mt-2 flex gap-2 text-xs">
                                            <span className={`px-2 py-1 rounded ${a.estado === "CONFIRMADO" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                                                {a.estado}
                                            </span>
                                            <span className={`px-2 py-1 rounded ${a.paymentStatus === "PAID" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                                                {a.paymentStatus === "PAID" ? "Pagado" : "Seña Pendiente"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Botones Principales */}
                                    {!isEditing && !isCancelling && (
                                        <div className="flex items-start gap-2">
                                            <button
                                                onClick={() => startEdit(a)}
                                                className={`btn text-sm ${canReschedule ? 'btn-outline' : 'text-gray-400 cursor-not-allowed'}`}
                                                title={!canReschedule ? "Menos de 24hs: no se puede reprogramar" : ""}
                                            >
                                                Reprogramar
                                            </button>
                                            <button onClick={() => requestCancel(a)} className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 text-sm">
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Panel de Cancelación */}
                                {isCancelling && (
                                    <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-2">
                                        <p className="font-semibold text-red-800 mb-2">
                                            {hoursDiff >= 24
                                                ? "Estás a tiempo de cancelar con reintegro (50%)."
                                                : "Faltan menos de 24hs. Perderás la seña."}
                                        </p>

                                        {hoursDiff >= 24 && (
                                            <div className="mb-3">
                                                <label className="block text-sm font-medium text-red-800">Tu Alias/CBU para la devolución:</label>
                                                <input
                                                    className="input mt-1 border-red-200 focus:ring-red-500"
                                                    placeholder="mi.alias.mp"
                                                    value={cbu}
                                                    onChange={e => setCbu(e.target.value)}
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setCancellingId(null)} className="btn btn-outline bg-white text-sm">Volver</button>
                                            <button onClick={() => confirmCancel(a.id, hoursDiff)} className="btn bg-red-600 text-white hover:bg-red-700 text-sm">
                                                Confirmar Cancelación
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Panel de Reprogramación */}
                                {isEditing && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                        <h3 className="font-medium mb-3">Elegir nueva fecha</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold uppercase text-muted">Día</label>
                                                <input
                                                    type="date"
                                                    className="input mt-1"
                                                    value={editDate}
                                                    min={todayISO}
                                                    onChange={(e) => {
                                                        setEditDate(e.target.value);
                                                        loadEditSlots(a.professionalId, e.target.value, a.id, a.serviceName);
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold uppercase text-muted">Horario</label>
                                                <select
                                                    className="input mt-1"
                                                    value={editSelected}
                                                    onChange={e => setEditSelected(e.target.value)}
                                                    disabled={loadingSlots}
                                                >
                                                    <option value="">{loadingSlots ? "Buscando..." : editSlots.length ? "-- Seleccionar --" : "Sin cupos"}</option>
                                                    {editSlots.map(s => {
                                                        const d = new Date(s);
                                                        const hh = String(d.getHours()).padStart(2, '0');
                                                        const mm = String(d.getMinutes()).padStart(2, '0');
                                                        return <option key={s} value={s}>{hh}:{mm}</option>;
                                                    })}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-end mt-4">
                                            <button onClick={() => setEditingId(null)} className="btn btn-outline bg-white text-sm">Cancelar</button>
                                            <button onClick={() => saveEdit(a)} className="btn btn-primary text-sm" disabled={!editSelected}>
                                                Guardar Cambio
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </section>
        </div>
    );
}