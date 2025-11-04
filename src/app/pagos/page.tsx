"use client";

import { useEffect, useMemo, useState } from "react";

type ListItem = {
    id: string;
    status: "PENDING" | "PAID" | "CANCELED";
    createdAt: string;      // fecha de creación del pago (auditoría)
    amountService: number;
    amountPenalty: number;
    amountTotal: number;
    note: string | null;
    appointmentId: string;
    serviceName: string;
    patientName: string;
    professionalName: string;
    apptDate: string | null; // ← FECHA EFECTIVA DEL TURNO
};

type ListResp = { count: number; items: ListItem[]; error?: string };

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

function fmtDate(dt: string | null) {
    if (!dt) return "—";
    const d = new Date(dt);
    if (isNaN(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${da}/${m}/${y} ${hh}:${mm}`;
}

export default function PagosPage() {
    const today = useMemo(() => toYMD(new Date()), []);
    const [date, setDate] = useState<string>(today);
    const [status, setStatus] = useState<"PENDING" | "PAID" | "ALL">("PENDING");
    const [q, setQ] = useState("");
    const [rows, setRows] = useState<ListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const load = async () => {
        setLoading(true);
        const qs = new URLSearchParams();
        if (date) qs.set("date", date);           // ← El backend filtra por appointment.fecha
        if (status) qs.set("status", status);
        const r = await fetch(`/api/payments/list?${qs.toString()}`);
        const { ok, data, error } = await safeJson<ListResp>(r);
        if (!ok) setMsg(error ?? "Error cargando pagos");
        else setRows((data as ListResp).items);
        setLoading(false);
    };

    useEffect(() => {
        load().catch(() => { });
        // eslint-disable-next-line
    }, [date, status]);

    const filtered = rows.filter((x) => {
        if (!q.trim()) return true;
        const hay = (s: any) => (s ?? "").toString().toLowerCase();
        const needle = q.trim().toLowerCase();
        return (
            hay(x.patientName).includes(needle) ||
            hay(x.professionalName).includes(needle) ||
            hay(x.serviceName).includes(needle)
        );
    });

    const markPaid = async (id: string) => {
        setMsg("");
        if (!window.confirm("¿Confirmás marcar como pagado?")) return;
        const r = await fetch("/api/payments/mark-paid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: id }),
        });
        const { ok, error } = await safeJson<any>(r);
        if (!ok) setMsg(error ?? "No se pudo marcar como pagado");
        await load();
    };

    return (
        <div className="space-y-6">
            <h1 className="h1">Pagos <span className="badge ml-2">Caja</span></h1>

            {/* Filtros */}
            <section className="card">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                        <label className="block text-sm font-medium">Fecha de consulta</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="input mt-1"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Estado</label>
                        <select
                            className="input mt-1"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                        >
                            <option value="PENDING">Pendientes</option>
                            <option value="PAID">Pagados</option>
                            <option value="ALL">Todos</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Buscar</label>
                        <input
                            className="input mt-1"
                            placeholder="Paciente, profesional o servicio…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>
            </section>

            {/* Tabla */}
            <section className="card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-muted">
                                <th className="py-2 pr-3">Fecha turno</th>
                                <th className="py-2 pr-3">Paciente</th>
                                <th className="py-2 pr-3">Profesional</th>
                                <th className="py-2 pr-3">Servicio</th>
                                <th className="py-2 pr-3 text-right">Servicio</th>
                                <th className="py-2 pr-3 text-right">Penalidad</th>
                                <th className="py-2 pr-3 text-right">Total</th>
                                <th className="py-2 pr-3">Estado</th>
                                <th className="py-2 pr-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="py-4 text-muted" colSpan={9}>Cargando…</td></tr>
                            ) : !filtered.length ? (
                                <tr><td className="py-4 text-muted" colSpan={9}>Sin resultados</td></tr>
                            ) : (
                                filtered.map((p) => {
                                    // ← Mostramos SIEMPRE la fecha efectiva del turno
                                    const fechaTurno = fmtDate(p.apptDate ?? null);
                                    return (
                                        <tr key={p.id} className="border-t" style={{ borderColor: "var(--card-border)" }}>
                                            <td className="py-2 pr-3">{fechaTurno}</td>
                                            <td className="py-2 pr-3">{p.patientName}</td>
                                            <td className="py-2 pr-3">{p.professionalName}</td>
                                            <td className="py-2 pr-3">{p.serviceName}</td>
                                            <td className="py-2 pr-3 text-right">${p.amountService}</td>
                                            <td className="py-2 pr-3 text-right">{p.amountPenalty ? `$${p.amountPenalty}` : "—"}</td>
                                            <td className="py-2 pr-3 text-right font-semibold">${p.amountTotal}</td>
                                            <td className="py-2 pr-3">
                                                <span className="badge">{p.status === "PAID" ? "Pagado" : "Pendiente"}</span>
                                            </td>
                                            <td className="py-2 pr-3 text-right">
                                                {p.status === "PENDING" ? (
                                                    <button onClick={() => markPaid(p.id)} className="btn btn-primary text-xs">Marcar pagado</button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {msg ? <div className="card bg-(--brand-warn)/20 border-brand">{msg}</div> : null}
        </div>
    );
}
