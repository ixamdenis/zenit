"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Professional = {
    id: string;
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
    const router = useRouter();
    const todayISO = useMemo(() => toYMD(new Date()), []);

    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [slots, setSlots] = useState<string[]>([]);

    const [step, setStep] = useState(1);
    const [proEmail, setProEmail] = useState("");
    const [serviceName, setServiceName] = useState("");
    const [date, setDate] = useState(todayISO);
    const [selectedSlot, setSelectedSlot] = useState("");

    const [loadingPros, setLoadingPros] = useState(true);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState("");

    // 1. Cargar Profesionales
    useEffect(() => {
        fetch("/api/paciente/profesionales")
            .then(r => r.json())
            .then(data => {
                setProfessionals(data.professionals ?? []);
            })
            .finally(() => setLoadingPros(false));
    }, []);

    // 2. Cargar Servicios cuando cambia el profesional
    useEffect(() => {
        setServices([]);
        setServiceName("");
        if (!proEmail) return;
        fetch(`/api/services/list?email=${proEmail}`)
            .then(r => r.json())
            .then(data => {
                const s = data.services || [];
                setServices(s);
                if (s.length > 0) setServiceName(s[0].nombre);
            });
    }, [proEmail]);

    // 3. Cargar Horarios
    const loadSlots = async () => {
        if (!proEmail || !serviceName || !date) { setSlots([]); return; }
        setLoadingSlots(true);
        const qs = new URLSearchParams({ date, professionalEmail: proEmail, serviceName });
        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { ok, data, error } = await safeJson<SlotsResp>(r);
        if (!ok) setMsg(error ?? "Error cargando horarios");
        setSlots(data?.slots ?? []);
        setLoadingSlots(false);
    };

    useEffect(() => {
        setSelectedSlot("");
        loadSlots().catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [proEmail, serviceName, date]);

    const selectedPro = professionals.find(p => p.email === proEmail);
    const selectedSrv = services.find(s => s.nombre === serviceName);

    const handleCreateAppointment = async () => {
        setCreating(true);
        setMsg("");
        const r = await fetch("/api/appointments", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ professionalEmail: proEmail, serviceName: serviceName, startAtISO: selectedSlot })
        });
        const { ok, error } = await safeJson<any>(r);
        if (!ok) { setMsg(error ?? "Error creando turno"); setCreating(false); }
        else {
            setMsg("¡Turno reservado!");
            setTimeout(() => router.push("/paciente"), 2000);
        }
    };

    if (loadingPros) return <div className="text-center p-8">Cargando...</div>;

    if (step === 2 && selectedPro && selectedSrv) {
        return (
            <div className="space-y-6 max-w-lg mx-auto">
                <h1 className="h1">Confirmar Turno</h1>
                <div className="card space-y-4">
                    <p><strong>Profesional:</strong> {selectedPro.apellido}, {selectedPro.nombre}</p>
                    <p><strong>Servicio:</strong> {selectedSrv.nombre}</p>
                    <p><strong>Fecha:</strong> {fmtDate(selectedSlot)}hs</p>
                    <p className="text-xl font-bold">Total: ${selectedSrv.precioBase}</p>
                </div>
                <div className="card bg-amber-50 border-amber-200 p-4">
                    <h3 className="font-bold text-amber-800">Pago Requerido</h3>
                    <p className="mt-2">Transferir a:</p>
                    <p className="font-mono text-lg font-bold my-1">{selectedPro.aliasBancario || "(Consultar)"}</p>
                    <h1 className="text-s text-blue-950 font-bold my-0.5">
                        Enviar comprobante por WhatsApp al{' '}
                        <a
                            href="https://api.whatsapp.com/send/?phone=5492920593967"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline cursor-pointer"
                        >
                            2920-593967
                        </a>
                        .
                    </h1>
                    <h1 className="text-s text-blue-950 font-semibold my-0.5">El turno será confirmado a la brevedad por esa vía.</h1>
                </div>
                <button onClick={handleCreateAppointment} disabled={creating} className="btn btn-primary w-full">{creating ? "Reservando..." : "Confirmar Reserva"}</button>
                <button onClick={() => setStep(1)} disabled={creating} className="btn btn-outline w-full mt-2">Volver</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <h1 className="h1">Solicitar Turno</h1>
            <div className="card space-y-4">
                <div>
                    <label className="text-sm font-medium">1. Profesional</label>
                    <select className="input mt-1" value={proEmail} onChange={(e) => setProEmail(e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        {professionals.map((p) => <option key={p.id} value={p.email}>{p.apellido}, {p.nombre} ({p.especialidad})</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">2. Servicio</label>
                    <select className="input mt-1" value={serviceName} onChange={(e) => setServiceName(e.target.value)} disabled={!proEmail}>
                        {!proEmail && <option value="">Elige profesional primero</option>}
                        {services.map((s) => <option key={s.id} value={s.nombre}>{s.nombre} (${s.precioBase})</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">3. Fecha</label>
                    <input type="date" value={date} min={todayISO} onChange={(e) => setDate(e.target.value)} className="input mt-1" disabled={!serviceName} />
                </div>
                <div>
                    <label className="text-sm font-medium">4. Horario</label>
                    <select className="input mt-1" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} disabled={loadingSlots || !slots.length}>
                        <option value="">{loadingSlots ? "Cargando..." : slots.length ? "-- Elegir --" : "Sin cupo"}</option>
                        {slots.map(s => <option key={s} value={s}>{new Date(s).getHours()}:{String(new Date(s).getMinutes()).padStart(2, '0')}</option>)}
                    </select>
                </div>
                <button onClick={() => { if (selectedSlot) setStep(2); else setMsg("Completa todo"); }} disabled={!selectedSlot} className="btn btn-primary w-full">Siguiente</button>
            </div>
            {msg && <div className="text-red-600 text-center text-sm">{msg}</div>}
        </div>
    );
}