"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ProfessionalService, Role } from "@prisma/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import localeEs from '@fullcalendar/core/locales/es';
import Link from "next/link";


// --- FUNCIÓN CLAVE PARA ELIMINAR ACENTOS ---
const removeAccents = (str: string) => {
    // Normaliza a una forma de descomposición canónica (NFD)
    // y luego usa una expresión regular para remover los caracteres diacríticos.
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
// ------------------------------------------


// --- TIPO FALTANTE CORREGIDO ---
type SlotsResp = { slots: string[]; professionalId?: string; error?: string; services?: ProfessionalService[] };

// Interfaces para la UI
interface UIUser {
    id: string; // patientId
    email: string;
    nombre: string;
    apellido: string;
    dni: string;
    nombreCompleto: string;
}

interface UIProfessional {
    id: string; // professionalProfileId
    userId: string;
    nombre: string;
    apellido: string;
    email: string;
}

interface UIAppointment {
    id: string;
    startAt: string;
    endAt: string;
    estado: string;
    serviceName: string;
    patientName: string;
    professionalName: string;
    isPaid: boolean;
}

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
}

// Helper para parsear JSON de forma segura
async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}

// Componente para el formulario de registro (Modal)
const PatientRegistrationForm = ({ onClose, onSuccess, initialEmail = "" }: { onClose: () => void, onSuccess: (email: string) => void, initialEmail?: string }) => {
    const [form, setForm] = useState<NewPatientForm>({
        nombre: "", apellido: "", email: initialEmail, dni: "", telefono: "", fechaNacimiento: "", localidad: "", tieneObraSocial: false, obraSocialNombre: ""
    });
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg("");

        const { nombre, apellido, email, dni } = form;
        if (!nombre || !apellido || !email || !dni) {
            setMsg("Por favor, completa los campos obligatorios (Nombre, Apellido, Email, DNI).");
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
                onSuccess(email);
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
                <p className="text-xs text-muted mb-3">Se creará con clave genérica: <strong>Zenit123</strong>. DNI es obligatorio.</p>

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
                    <div>
                        <label className="block text-sm font-medium">Email *</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input mt-1" required />
                    </div>
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

export default function RecepcionPage() {
    const [msg, setMsg] = useState<string>("");

    // Datos maestros
    const [pacientesList, setPacientesList] = useState<UIUser[]>([]);
    const [profesionales, setProfesionales] = useState<UIProfessional[]>([]);
    const [services, setServices] = useState<ProfessionalService[]>([]);
    const [appointments, setAppointments] = useState<UIAppointment[]>([]);
    const [loading, setLoading] = useState(false);

    // Estados de UI y búsqueda
    const [isRegistering, setIsRegistering] = useState(false);
    const [filterText, setFilterText] = useState("");
    const [slots, setSlots] = useState<string[]>([]); // Slots disponibles

    // Estado Formulario Nuevo Turno
    const [newAppointment, setNewAppointment] = useState({
        pacienteId: "",
        profesionalEmail: "",
        serviceName: "",
        date: new Date().toISOString().split('T')[0],
        time: "", // Almacena el ISO string del slot seleccionado
    });

    // --- BLOQUE CORREGIDO CON FILTRADO ACCENT-INSENSITIVE ---
    const filteredPacientesList = useMemo(() => {
        if (!filterText) return pacientesList;

        // 1. Normalizar y lower case la búsqueda una sola vez
        const normalizedSearch = removeAccents(filterText.toLowerCase());

        return pacientesList.filter(p => {

            // 2. Normalizar y lower case los campos del paciente
            const normalizedNombre = removeAccents(p.nombre.toLowerCase());
            const normalizedApellido = removeAccents(p.apellido.toLowerCase());
            const normalizedDni = removeAccents(p.dni.toLowerCase());
            const normalizedEmail = removeAccents(p.email.toLowerCase());

            // 3. Chequear si la búsqueda está incluida en cualquiera de los campos normalizados
            return (
                normalizedNombre.includes(normalizedSearch) ||
                normalizedApellido.includes(normalizedSearch) ||
                normalizedEmail.includes(normalizedSearch) ||
                normalizedDni.includes(normalizedSearch)
            );
        });
    }, [pacientesList, filterText]);
    // ----------------------------------------------------


    const fetchPacientes = useCallback(async () => {
        const rDump = await fetch("/api/debug/dump");
        const dDump = await rDump.json();

        const pacientesMapped: UIUser[] = (dDump.patients || []).map((p: any) => ({
            id: p.patientId,
            email: p.userEmail,
            nombre: p.nombre,
            apellido: p.apellido,
            dni: p.dni || '',
            nombreCompleto: `${p.nombre} ${p.apellido}`
        }));
        setPacientesList(pacientesMapped);
    }, []);

    // Carga inicial (Incluye Fetch de Pacientes, Profesionales y Turnos)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                await fetchPacientes();

                // 2. Cargar Profesionales
                const rProf = await fetch("/api/paciente/profesionales");
                const dProf = await rProf.json();
                setProfesionales(dProf.professionals || []);

                // 3. Cargar Turnos (del día de hoy por defecto)
                const todayStr = new Date().toISOString().split('T')[0];
                const rAppts = await fetch(`/api/appointments/list?date=${todayStr}`);
                const dAppts = await rAppts.json();

                if (dAppts.appointments) {
                    const mappedAppts: UIAppointment[] = dAppts.appointments.map((a: any) => ({
                        id: a.id,
                        startAt: a.startAt,
                        endAt: a.endAt,
                        estado: a.estado,
                        serviceName: a.serviceName,
                        patientName: a.patientName,
                        professionalName: a.professionalName,
                        isPaid: a.paymentStatus === 'PAID'
                    }));
                    setAppointments(mappedAppts);
                }

            } catch (e) {
                console.error(e);
                setMsg("Error al cargar datos iniciales");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [fetchPacientes]);

    // Cargar servicios y slots
    useEffect(() => {
        const fetchServicesAndSlots = async () => {
            const { date, profesionalEmail, serviceName } = newAppointment;
            setServices([]);
            setSlots([]);
            setNewAppointment(prev => ({ ...prev, time: "" }));

            if (!profesionalEmail) return;

            // 1. Cargar servicios
            const rSrv = await fetch(`/api/services/list?email=${profesionalEmail}`);
            const dSrv = await rSrv.json();
            const fetchedServices = dSrv.services || [];
            setServices(fetchedServices);

            if (fetchedServices.length > 0 && !serviceName) {
                setNewAppointment(prev => ({ ...prev, serviceName: fetchedServices[0].nombre }));
                return;
            }

            if (!serviceName || !date) return;

            // 2. Cargar slots
            const qs = new URLSearchParams({ date, professionalEmail: profesionalEmail, serviceName });
            const r = await fetch(`/api/agenda?${qs.toString()}`);
            const { data, ok, error } = await safeJson<SlotsResp>(r);

            if (ok) {
                setSlots(data?.slots || []);
            } else {
                setMsg(error ?? "Error cargando horarios");
            }
        };

        fetchServicesAndSlots();
    }, [newAppointment.profesionalEmail, newAppointment.serviceName, newAppointment.date]);


    // Acción: Crear Turno
    const createAppointment = async () => {
        setMsg("");
        const { pacienteId, profesionalEmail, serviceName, date, time } = newAppointment;

        if (!pacienteId || !profesionalEmail || !serviceName || !date || !time) {
            setMsg("Faltan datos para crear el turno.");
            return;
        }

        const startAtISO = time; // El campo time contiene el ISO string del slot seleccionado

        try {
            const r = await fetch("/api/appointments", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientEmail: pacienteId,
                    professionalEmail: profesionalEmail,
                    serviceName: serviceName,
                    startAtISO: startAtISO
                })
            });
            const res = await r.json();
            if (r.ok) {
                setMsg(`Turno con ${res.appointment.professionalService.nombre} creado con éxito.`);
                // Recargar lista de turnos (opcional)
            } else {
                setMsg(res.error || "Error al crear turno");
            }
        } catch (e) {
            setMsg("Error de conexión");
        }
    };

    // Renderizado de eventos para FullCalendar
    const calendarEvents = appointments.map(app => ({
        id: app.id,
        title: `${app.patientName} - ${app.serviceName}`,
        start: app.startAt,
        end: app.endAt,
        backgroundColor: app.isPaid ? '#10b981' : '#3b82f6',
        borderColor: app.isPaid ? '#059669' : '#2563eb',
    }));

    if (loading) return <div className="p-8 text-center">Cargando panel...</div>;

    return (
        <div className="space-y-8">
            {/* Modal de Registro */}
            {isRegistering && (
                <PatientRegistrationForm
                    onClose={() => setIsRegistering(false)}
                    onSuccess={async (email) => {
                        setIsRegistering(false);
                        setMsg(`Paciente ${email} creado con éxito. Clave temporal: Zenit123.`);
                        await fetchPacientes(); // Recargar lista de pacientes
                        setNewAppointment(prev => ({ ...prev, pacienteId: email })); // Seleccionar nuevo paciente
                    }}
                />
            )}

            <h1 className="h1">Panel de Recepción</h1>

            {msg && <div className="card bg-amber-50 border-amber-200 text-amber-800 p-3 text-sm font-medium">{msg}</div>}

            {/* 1. CREAR TURNO */}
            <section className="card">
                <h2 className="h2 mb-4">Crear Turno Manual</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4 items-end">

                    {/* Paciente (Searchable) */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Buscar Paciente (Nombre, Apellido, DNI)</label>
                        <div className="flex gap-2 mt-1">
                            {/* Input de Búsqueda */}
                            <input
                                type="text"
                                className="input"
                                placeholder="Escriba para filtrar pacientes"
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                            />
                            {/* Botón para crear nuevo paciente */}
                            <button onClick={() => setIsRegistering(true)} className="btn btn-outline text-xs h-[42px] px-3 font-bold text-green-700" title="Registrar nuevo paciente">
                                + Nuevo
                            </button>
                        </div>
                        {/* Select Filtrado */}
                        <select
                            className="input mt-2"
                            size={filterText ? Math.min(6, filteredPacientesList.length + 1) : 1}
                            value={newAppointment.pacienteId}
                            onChange={e => setNewAppointment({ ...newAppointment, pacienteId: e.target.value })}
                        >
                            {filteredPacientesList.length === 0 ? (
                                <option value="" disabled>No se encontraron pacientes. Usa "+ Nuevo".</option>
                            ) : (
                                <>
                                    <option value="">-- Seleccionar --</option>
                                    {filteredPacientesList.map(p => (
                                        <option key={p.email} value={p.email}>
                                            {p.nombreCompleto} (DNI: {p.dni || 'N/A'})
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>

                    {/* Profesional */}
                    <div>
                        <label className="block text-sm font-medium">Profesional</label>
                        <select
                            className="input mt-1"
                            value={newAppointment.profesionalEmail}
                            onChange={e => setNewAppointment({ ...newAppointment, profesionalEmail: e.target.value })}
                        >
                            <option value="">Seleccione...</option>
                            {profesionales.map(p => (
                                <option key={p.id} value={p.email}>{p.apellido}, {p.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Servicio */}
                    <div>
                        <label className="block text-sm font-medium">Servicio</label>
                        <select
                            className="input mt-1"
                            value={newAppointment.serviceName}
                            onChange={e => setNewAppointment({ ...newAppointment, serviceName: e.target.value })}
                            disabled={!services.length}
                        >
                            <option value="">Seleccione...</option>
                            {services.map(s => (
                                <option key={s.id} value={s.nombre}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-4 mt-4 items-end">
                    <div className="col-span-1">
                        <label className="block text-sm font-medium">Fecha</label>
                        <input
                            type="date"
                            className="input mt-1"
                            value={newAppointment.date}
                            onChange={e => setNewAppointment({ ...newAppointment, date: e.target.value, time: "" })}
                            min={new Date().toISOString().split('T')[0]}
                            disabled={!newAppointment.profesionalEmail || !newAppointment.serviceName}
                        />
                    </div>

                    <div className="col-span-1">
                        <label className="block text-sm font-medium">Horario</label>
                        <select
                            className="input mt-1"
                            value={newAppointment.time}
                            onChange={e => setNewAppointment({ ...newAppointment, time: e.target.value })}
                            disabled={!slots.length}
                        >
                            <option value="">{newAppointment.date && !newAppointment.profesionalEmail || !newAppointment.serviceName ? "Selecciona Profesional/Servicio" : slots.length === 0 ? "Sin horarios" : "-- Elegir --"}</option>

                            {slots.map(s => (
                                <option key={s} value={s}>
                                    {new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-3">
                        <button onClick={createAppointment} className="btn btn-primary w-full h-[42px]"
                            disabled={!newAppointment.pacienteId || !newAppointment.time}>
                            Confirmar Turno
                        </button>
                    </div>
                </div>
            </section>

            {/* 2. CALENDARIO (Localización en Español Manual) */}
            <section className="card overflow-hidden">
                <h2 className="h2 mb-4">Agenda Semanal</h2>
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    locale={localeEs}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek'
                    }}
                    events={calendarEvents}
                    height="auto"
                    slotMinTime="08:00:00"
                    slotMaxTime="21:00:00"
                    allDaySlot={false}
                />
            </section>
        </div>
    );
}