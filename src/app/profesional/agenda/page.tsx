"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { SessionPayload } from "@/lib/session";

// --- HELPERS Y TIPOS ---

// Función para remover acentos (para búsqueda)
const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

type DumpData = {
    patients: { patientId: string; nombre: string; apellido: string; dni: string; userEmail: string }[];
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

// Interfaz para el formulario de registro completo (Incluye el nuevo flag)
interface NewPatientForm {
    nombre: string;
    apellido: string;
    email: string;
    dni: string;
    telefono: string;
    fechaNacimiento: string;
    localidad: string;
    tieneObraSocial: boolean;
    obraSocialNombre: string;
    hasNoEmail: boolean; // <--- FLAG AGREGADO
}

async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}
function toYMD(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }


// --- COMPONENTE MODAL DE REGISTRO COMPLETO ---
const PatientRegistrationForm = ({ onClose, onSuccess, initialEmail = "" }: { onClose: () => void, onSuccess: (email: string) => void, initialEmail?: string }) => {
    const [form, setForm] = useState<NewPatientForm>({
        nombre: "", apellido: "", email: initialEmail, dni: "", telefono: "", fechaNacimiento: "", localidad: "", tieneObraSocial: false, obraSocialNombre: "", hasNoEmail: false
    });
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg("");

        const { nombre, apellido, email, dni, hasNoEmail } = form;
        if (!nombre || !apellido || !dni) {
            setMsg("Por favor, completa los campos obligatorios (Nombre, Apellido, DNI).");
            return;
        }

        if (!email && !hasNoEmail) {
            setMsg("El Email es obligatorio, o debes marcar 'No tiene email'.");
            return;
        }

        setCreating(true);
        try {
            const r = await fetch("/api/paciente/crear-manual", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            });
            const data = await r.json();

            if (r.ok) {
                // Si no tiene email, devolvemos el placeholder que el backend usa para identificar al usuario
                const returnEmail = hasNoEmail ? `dni-${dni.replace(/[^0-9]/g, '')}@nodireccion.zenit` : email;
                onSuccess(returnEmail);
            } else {
                setMsg(data.error ?? "Error al registrar paciente.");
            }
        } catch (error) {
            setMsg("Error de conexión al intentar registrar.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="h2 flex justify-between items-center mb-4">
                    Registro Completo de Paciente
                    <button onClick={onClose} className="text-red-600 text-sm hover:underline">Cerrar</button>
                </h2>
                <p className="text-xs text-muted mb-3">Clave genérica: <strong>Zenit123</strong>. DNI es obligatorio. Login será por Email o DNI.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Nombre *</label>
                            <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="input mt-1" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Apellido *</label>
                            <input type="text" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className="input mt-1" required />
                        </div>
                    </div>

                    {/* --- CHECKBOX Y CAMPO EMAIL --- */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="noEmailCheck"
                            checked={form.hasNoEmail}
                            onChange={(e) => setForm(p => ({ ...p, hasNoEmail: e.target.checked, email: e.target.checked ? "" : p.email }))}
                            className="h-4 w-4 rounded"
                        />
                        <label htmlFor="noEmailCheck" className="text-sm font-medium">No tiene email (Login con DNI)</label>
                    </div>

                    <div style={{ opacity: form.hasNoEmail ? 0.5 : 1 }}>
                        <label className="block text-sm font-medium">Email {!form.hasNoEmail && "*"}</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input mt-1" required={!form.hasNoEmail} disabled={form.hasNoEmail} />
                    </div>
                    {/* ----------------------------- */}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">DNI *</label>
                            <input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className="input mt-1" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Teléfono</label>
                            <input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="input mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Fecha de Nacimiento</label>
                            <input type="date" value={form.fechaNacimiento} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} className="input mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Localidad</label>
                            <input type="text" value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} className="input mt-1" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                        <input
                            type="checkbox"
                            id="obraSocialCheck"
                            checked={form.tieneObraSocial}
                            onChange={(e) => setForm({ ...form, tieneObraSocial: e.target.checked, obraSocialNombre: "" })}
                            className="h-4 w-4 rounded"
                        />
                        <label htmlFor="obraSocialCheck" className="text-sm font-medium">Tiene Obra Social</label>
                    </div>

                    {form.tieneObraSocial && (
                        <div>
                            <label className="block text-sm font-medium">Nombre Obra Social</label>
                            <input
                                type="text"
                                value={form.obraSocialNombre}
                                onChange={(e) => setForm({ ...form, obraSocialNombre: e.target.value })}
                                className="input mt-1"
                                placeholder="Ej: OSDE"
                            />
                        </div>
                    )}

                    <button type="submit" disabled={creating} className="btn btn-primary w-full mt-6">
                        {creating ? "Registrando..." : "Crear Paciente"}
                    </button>
                    {msg && <div className="mt-4 text-center text-sm text-red-600">{msg}</div>}
                </form>
            </div>
        </div>
    );
};
// --- FIN COMPONENTE MODAL ---


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

    // --- ESTADOS NUEVOS PARA ALTA PACIENTE y BÚSQUEDA ---
    const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);
    const [filterText, setFilterText] = useState("");
    // ----------------------------------------

    // --- FUNCIÓN PARA RECARGAR PACIENTES ---
    const fetchPatients = useCallback(async () => {
        const r = await fetch("/api/debug/dump");
        const data = await r.json();
        setPatients(data.patients || []);
    }, []);
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

    // 2. Cargar Pacientes (al inicio)
    useEffect(() => {
        fetchPatients().catch(() => { });
    }, [fetchPatients]);

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

    // --- LÓGICA DE FILTRADO (Accent-Insensitive) ---
    const filteredPacientesList = useMemo(() => {
        if (!filterText) return patients;

        const normalizedSearch = removeAccents(filterText.toLowerCase());

        return patients.filter(p => {
            const normalizedNombre = removeAccents(p.nombre.toLowerCase());
            const normalizedApellido = removeAccents(p.apellido.toLowerCase());
            const normalizedDni = removeAccents(p.dni?.toLowerCase() || "");
            const fullNormalizedName = `${normalizedNombre} ${normalizedApellido}`;

            return (
                fullNormalizedName.includes(normalizedSearch) ||
                normalizedDni.includes(normalizedSearch)
            );
        });
    }, [patients, filterText]);
    // ------------------------------------------------


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

    const startEdit = async (a: any) => {
        setEditingId(a.id);
        const cur = new Date(a.startAt); cur.setHours(0, 0, 0, 0);
        setEditDate(toYMD(cur));
        // Cargar slots para edit
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

            {/* --- Modal de Registro de Paciente COMPLETO --- */}
            {isRegisteringPatient && (
                <PatientRegistrationForm
                    onClose={() => setIsRegisteringPatient(false)}
                    onSuccess={async (email) => {
                        setIsRegisteringPatient(false);
                        setMsg(`Paciente ${email} creado con éxito. Clave temporal: Zenit123.`);
                        await fetchPatients(); // Recargar lista de pacientes
                        setPatientEmail(email); // Autoseleccionar el nuevo paciente
                    }}
                />
            )}
            {/* ------------------------------------------------ */}

            <section className="card">
                <h2 className="h2">Ver día</h2>
                <div className="mt-3">
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto" />
                </div>
            </section>

            <section className="card">
                <h2 className="h2">Crear turno manual</h2>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

                    {/* Campo Paciente con búsqueda y botón + Nuevo */}
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium">Buscar Paciente (Nombre, DNI)</label>
                        <div className="flex gap-2 mt-1">
                            {/* Input de Búsqueda */}
                            <input
                                type="text"
                                className="input"
                                placeholder="Escriba para filtrar"
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                            />
                            {/* Botón para crear nuevo paciente */}
                            <button onClick={() => setIsRegisteringPatient(true)} className="btn btn-outline text-xs h-[42px] px-3 font-bold text-green-700" title="Registrar nuevo paciente">+</button>
                        </div>
                        {/* Select Filtrado */}
                        <select
                            className="input mt-2"
                            size={filterText ? Math.min(6, filteredPacientesList.length + 1) : 1} // Muestra lista al escribir
                            value={patientEmail}
                            onChange={(e) => setPatientEmail(e.target.value)}
                        >
                            {filteredPacientesList.length === 0 ? (
                                <option value="" disabled>No hay coincidencias. Usa "+".</option>
                            ) : (
                                <>
                                    <option value="">-- Elegir --</option>
                                    {filteredPacientesList.map((p) => <option key={p.patientId} value={p.userEmail}>{p.apellido}, {p.nombre} ({p.dni || 'N/A'})</option>)}
                                </>
                            )}
                        </select>
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