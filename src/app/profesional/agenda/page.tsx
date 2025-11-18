"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionPayload } from "@/lib/session";

type DumpData = {
    patients: { patientId: string; nombre: string; apellido: string; userEmail: string }[];
};
type Service = { id: string; nombre: string; duracionMin: number; precioBase: number };
type SlotsResp = { slots: string[]; professionalId?: string; error?: string };
type ListResp = {
    date: string; count: number;
    appointments: {
        id: string; estado: string; startAt: string; endAt: string;
        serviceId: string; serviceName: string; roomId: string | null; roomName: string | null;
        patientId: string; professionalId: string; patientName: string; professionalName: string;
        paymentId: string | null;
        paymentStatus: "PENDING" | "PAID" | "CANCELED" | null;
    }[];
    error?: string;
};

// Definimos la interfaz para el formulario de nuevo paciente
interface NewPatientForm {
    nombre: string;
    apellido: string;
    email: string;
    dni: string;
    telefono: string;
}

async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}
function toYMD(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }

export default function ProfesionalAgendaPage() {
    const todayISO = useMemo(() => toYMD(new Date()), []);
    const [session, setSession] = useState<SessionPayload | null>(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [patients, setPatients] = useState<DumpData["patients"]>([]);
    const [myServices, setMyServices] = useState<Service[]>([]); // Servicios PROPIOS

    const [date, setDate] = useState<string>(todayISO);
    const [patientEmail, setPatientEmail] = useState<string>("");
    const [serviceName, setServiceName] = useState<string>("");
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string>("");
    const [list, setList] = useState<ListResp | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [creating, setCreating] = useState(false);

    // Acciones
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [payingId, setPayingId] = useState<string | null>(null);

    // Reprogramación
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string>("");
    const [editSlots, setEditSlots] = useState<Record<string, string[]>>({});
    const [editSelected, setEditSelected] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState<string>("");

    // --- ESTADOS NUEVOS PARA ALTA PACIENTE ---
    const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);
    const [newPac, setNewPac] = useState<NewPatientForm>({ nombre: "", apellido: "", email: "", dni: "", telefono: "" });
    const [creatingPac, setCreatingPac] = useState(false);
    // ----------------------------------------

    // 1. Cargar Sesión y Servicios
    useEffect(() => {
        (async () => {
            try {
                // Sesión
                const rSes = await fetch("/api/auth/me");
                const dSes = await rSes.json();
                if (dSes.user) {
                    setSession(dSes.user);
                    // Servicios Propios (desde Perfil)
                    const rPerf = await fetch("/api/profesional/perfil");
                    const dPerf = await rPerf.json();
                    const s = dPerf.services || [];
                    setMyServices(s);
                    if (s.length > 0) setServiceName(s[0].nombre);
                } else {
                    setMsg("No se pudo cargar sesión.");
                }
            } finally {
                setLoadingSession(false);
            }
        })();
    }, []);

    // 2. Cargar Pacientes
    useEffect(() => {
        fetch("/api/debug/dump")
            .then(r => r.json())
            .then(data => {
                setPatients(data.patients || []);
                // No seleccionamos por defecto para obligar al usuario a elegir
            })
            .catch(() => { });
    }, []);

    // 3. Cargar Lista de turnos
    const loadList = async () => {
        if (!session?.email) return;
        setLoadingList(true);
        const qs = new URLSearchParams({ date, professionalEmail: session.email });
        const r = await fetch(`/api/appointments/list?${qs.toString()}`);
        const { ok, data, error } = await safeJson<ListResp>(r);
        if (!ok) setMsg(error ?? "Error al listar turnos");
        else setList(data as ListResp);
        setLoadingList(false);
    };

    // 4. Cargar Slots
    const loadSlots = async () => {
        if (!date || !session?.email) { setSlots([]); return; }
        const qs = new URLSearchParams({ date, professionalEmail: session.email });
        if (serviceName) qs.set("serviceName", serviceName);

        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { ok, data, error } = await safeJson<SlotsResp>(r);
        if (!ok) { setSlots([]); }
        else setSlots((data as SlotsResp)?.slots ?? []);
    };

    useEffect(() => {
        if (session?.email) {
            loadList();
            loadSlots();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, session, serviceName]);


    // --- ACCIONES DE TURNO ---
    const createAppointment = async () => {
        setMsg("");
        if (!patientEmail || !serviceName || !selectedSlot || !session?.email) {
            setMsg("Faltan datos."); return;
        }
        setCreating(true);
        const r = await fetch("/api/appointments", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientEmail, professionalEmail: session.email, serviceName, startAtISO: selectedSlot })
        });
        const { ok, error } = await safeJson<any>(r);
        if (!ok) setMsg(error ?? "Error creando turno");
        else { setMsg("Turno creado."); setSelectedSlot(""); await loadList(); await loadSlots(); }
        setCreating(false);
    };

    const cancelAppointment = async (id: string) => {
        if (!session?.userId) return;
        if (!window.confirm("¿Cancelar turno?")) return;
        setCancellingId(id);
        const r = await fetch("/api/appointments/cancel", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: id, whoUserId: session.userId, reason: "Pro" })
        });
        const { ok } = await safeJson(r);
        if (ok) { setMsg("Cancelado."); await loadList(); await loadSlots(); }
        else setMsg("Error al cancelar.");
        setCancellingId(null);
    };

    const markPaid = async (pid: string) => {
        if (!window.confirm("¿Marcar pagado?")) return;
        setPayingId(pid);
        const r = await fetch("/api/payments/mark-paid", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: pid }),
        });
        const { ok } = await safeJson(r);
        if (ok) { setMsg("Pagado."); await loadList(); }
        else setMsg("Error.");
        setPayingId(null);
    };

    // --- ACCION: CREAR PACIENTE MANUAL (MODAL) ---
    const createPatientManual = async () => {
        setMsg("");
        if (!newPac.nombre || !newPac.apellido || !newPac.email || !newPac.dni) {
            setMsg("Faltan datos obligatorios del paciente (Nombre, Apellido, Email, DNI)");
            return;
        }
        setCreatingPac(true);
        try {
            const r = await fetch("/api/paciente/crear-manual", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newPac)
            });
            const data = await r.json();

            if (r.ok) {
                setMsg(data.message || "Paciente creado. Clave temporal: Zenit123");

                // Limpiar formulario y cerrar modal
                setNewPac({ nombre: "", apellido: "", email: "", dni: "", telefono: "" });
                setIsRegisteringPatient(false);

                // Recargar la lista de pacientes para que aparezca el nuevo
                fetch("/api/debug/dump")
                    .then(r => r.json())
                    .then(data => {
                        setPatients(data.patients || []);
                        // Opcional: Autoseleccionar el nuevo paciente (necesitamos saber su email)
                        setPatientEmail(newPac.email);
                    });
            } else {
                setMsg(data.error ?? "Error creando paciente");
            }
        } catch (error) {
            setMsg("Error de conexión");
        } finally {
            setCreatingPac(false);
        }
    };

    // Edit
    const startEdit = async (a: any) => {
        setEditingId(a.id);
        const cur = new Date(a.startAt); cur.setHours(0, 0, 0, 0);
        setEditDate(toYMD(cur));
        const qs = new URLSearchParams({ date: toYMD(cur), professionalId: a.professionalId, ignoreAppointmentId: a.id, serviceName: a.serviceName });
        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { data } = await safeJson<SlotsResp>(r);
        setEditSlots(p => ({ ...p, [a.id]: data?.slots ?? [] }));
        setEditSelected(p => ({ ...p, [a.id]: "" }));
    };
    const saveEdit = async (a: any) => {
        const pick = editSelected[a.id];
        if (!pick) return;
        if (!window.confirm("¿Reprogramar?")) return;
        const r = await fetch("/api/appointments/reschedule", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: a.id, newStartISO: pick })
        });
        const { ok } = await safeJson(r);
        if (ok) { setMsg("Reprogramado."); setEditingId(null); await loadList(); await loadSlots(); }
        else setMsg("Error.");
    };

    if (loadingSession) return <div className="text-center p-8">Cargando...</div>

    return (
        <div className="space-y-6">
            <h1 className="h1">Mi Agenda</h1>

            <section className="card">
                <h2 className="h2">Ver día</h2>
                <div className="mt-3">
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto" />
                </div>
            </section>

            {/* --- Formulario de registro de paciente (Modal) --- */}
            {isRegisteringPatient && (
                <section className="card border-l-4 border-l-brand-primary bg-blue-50">
                    <h2 className="h2 flex justify-between items-center">
                        Registro Rápido de Paciente
                        <button onClick={() => setIsRegisteringPatient(false)} className="text-red-600 text-sm hover:underline">Cerrar</button>
                    </h2>
                    <p className="text-xs text-muted mb-3">Clave genérica: <strong>Zenit123</strong>. DNI obligatorio.</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                            <label className="text-xs font-bold uppercase text-muted">Nombre</label>
                            <input className="input mt-1" value={newPac.nombre} onChange={e => setNewPac({ ...newPac, nombre: e.target.value })} placeholder="Nombre" required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted">Apellido</label>
                            <input className="input mt-1" value={newPac.apellido} onChange={e => setNewPac({ ...newPac, apellido: e.target.value })} placeholder="Apellido" required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted">Email</label>
                            <input type="email" className="input mt-1" value={newPac.email} onChange={e => setNewPac({ ...newPac, email: e.target.value })} placeholder="email@ejemplo.com" required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted">DNI</label>
                            <input className="input mt-1" value={newPac.dni} onChange={e => setNewPac({ ...newPac, dni: e.target.value })} placeholder="DNI" required />
                        </div>
                        <div className="md:col-span-4">
                            <label className="text-xs font-bold uppercase text-muted">Teléfono (Opcional)</label>
                            <input className="input mt-1" value={newPac.telefono} onChange={e => setNewPac({ ...newPac, telefono: e.target.value })} placeholder="11..." />
                        </div>
                        <button onClick={createPatientManual} disabled={creatingPac || !newPac.nombre || !newPac.apellido || !newPac.email || !newPac.dni} className="btn btn-primary w-full md:col-span-4 mt-2">
                            {creatingPac ? "Registrando..." : "Crear Paciente"}
                        </button>
                    </div>
                </section>
            )}
            {/* --- FIN Modal --- */}

            <section className="card">
                <h2 className="h2">Crear turno manual</h2>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Campo Paciente con opción de registro al lado */}
                    <div className="flex flex-col">
                        <label className="text-sm font-medium">Paciente</label>
                        <div className="flex gap-2 items-center mt-1">
                            <select className="input" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)}>
                                <option value="">-- Elegir --</option>
                                {patients.map((p) => <option key={p.patientId} value={p.userEmail}>{p.apellido}, {p.nombre}</option>)}
                            </select>
                            <button onClick={() => setIsRegisteringPatient(true)} className="btn btn-outline text-xs h-[42px] px-3 font-bold text-brand-primary" title="Registrar nuevo paciente">+</button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Servicio</label>
                        <select className="input mt-1" value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
                            {myServices.length === 0 && <option value="">(Sin servicios)</option>}
                            {myServices.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Horario</label>
                        <select className="input mt-1" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>
                            <option value="">{slots.length ? "-- Elegir --" : "Sin cupo"}</option>
                            {slots.map(s => <option key={s} value={s}>{new Date(s).getHours()}:{String(new Date(s).getMinutes()).padStart(2, '0')}</option>)}
                        </select>
                    </div>
                    <button onClick={createAppointment} disabled={creating} className="btn btn-primary h-[42px]">Crear</button>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <h2 className="h2">Turnos ({list?.count ?? 0})</h2>
                    <button onClick={() => loadList()} className="btn btn-outline text-sm">Actualizar</button>
                </div>
                {list?.appointments.map(a => (
                    <div key={a.id} className="card">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="font-medium">
                                    {new Date(a.startAt).getHours()}:{String(new Date(a.startAt).getMinutes()).padStart(2, '0')} · {a.serviceName}
                                </div>
                                <div className="text-sm text-muted">Paciente: {a.patientName}</div>
                                <div className={`text-sm font-semibold ${a.paymentStatus === "PAID" ? "text-green-600" : "text-amber-600"}`}>
                                    {a.paymentStatus === "PAID" ? "Pagado" : "Pendiente de pago"}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {a.paymentStatus === "PENDING" && a.paymentId && <button onClick={() => markPaid(a.paymentId!)} className="btn btn-primary text-xs">Cobrar</button>}
                                <button onClick={() => startEdit(a)} className="btn btn-outline text-xs">Mover</button>
                                <button onClick={() => cancelAppointment(a.id)} className="btn btn-outline text-xs">Cancelar</button>
                            </div>
                        </div>
                        {editingId === a.id && (
                            <div className="mt-2 pt-2 border-t flex gap-2 items-end">
                                <input type="date" value={editDate} onChange={e => { setEditDate(e.target.value); }} className="input text-sm" />
                                <select className="input text-sm" value={editSelected[a.id] || ""} onChange={e => setEditSelected(p => ({ ...p, [a.id]: e.target.value }))}>
                                    <option value="">Horario...</option>
                                    {editSlots[a.id]?.map(s => <option key={s} value={s}>{new Date(s).getHours()}:{String(new Date(s).getMinutes()).padStart(2, '0')}</option>)}
                                </select>
                                <button onClick={() => saveEdit(a)} className="btn btn-primary text-xs">Guardar</button>
                                <button onClick={() => setEditingId(null)} className="btn btn-outline text-xs">X</button>
                            </div>
                        )}
                    </div>
                ))}
            </section>
            {msg && <div className="card bg-brand-warn/20 border-brand p-4 text-sm">{msg}</div>}
        </div>
    );
}