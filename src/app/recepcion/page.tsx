"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ProfessionalService } from "@prisma/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import allLocales from '@fullcalendar/core/locales-all';
import Link from "next/link";

// --- HELPERS Y UTILS ---

const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}

// --- TIPOS ---

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

// Tipo para la respuesta de la lista de turnos
type ListResp = {
    range: { from: string; to: string };
    count: number;
    appointments: {
        id: string;
        estado: string;
        startAt: string;
        endAt: string;
        serviceId: string;
        serviceName: string;
        roomId: string | null;
        roomName: string | null;
        patientId: string;
        professionalId: string;
        patientName: string;
        professionalName: string;
        paymentId: string | null;
        paymentStatus: "PENDING" | "PAID" | "CANCELED" | null;
    }[];
    error?: string;
};

type SlotsResp = { slots: string[]; professionalId?: string; error?: string; services?: ProfessionalService[] };

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
    hasNoEmail: boolean;
}

// --- COMPONENTES AUXILIARES ---

// Formulario Modal de Registro de Paciente
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
            <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white p-6 rounded-xl shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Registro Completo de Paciente</h2>
                    <button onClick={onClose} className="text-red-600 text-sm hover:underline">Cerrar</button>
                </div>
                <p className="text-xs text-gray-500 mb-3">Clave genérica: <strong>Zenit123</strong>. DNI es obligatorio. Login será por Email o DNI.</p>

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

// Renderizado personalizado de eventos del calendario
function renderEventContent(eventInfo: any) {
    const { extendedProps } = eventInfo.event;
    const isPaid = extendedProps.isPaid;
    // Estilos condicionales según estado de pago
    const statusColor = isPaid
        ? "bg-green-50 text-green-800 border-green-400"
        : "bg-amber-50 text-amber-800 border-amber-400";
    const dotColor = isPaid ? "bg-green-500" : "bg-amber-500";

    return (
        <div className={`w-full h-full p-1 border-l-4 text-xs overflow-hidden flex flex-col leading-tight ${statusColor} rounded-sm`}>
            <div className="font-bold flex justify-between items-center mb-0.5">
                <span>{eventInfo.timeText}</span>
                <div className={`w-2 h-2 rounded-full ${dotColor}`} title={isPaid ? "Pagado" : "Pendiente"}></div>
            </div>
            <div className="font-semibold truncate" title={extendedProps.patientName}>{extendedProps.patientName}</div>
            <div className="truncate opacity-90 text-[10px]">{extendedProps.serviceName}</div>
            <div className="truncate opacity-75 italic text-[10px]">{extendedProps.professionalName}</div>
        </div>
    );
}

// Helper para navegar al perfil
const handleViewProfile = (patientId: string) => {
    window.location.href = `/recepcion/perfil-paciente/${patientId}`;
};


// --- COMPONENTE PRINCIPAL ---

export default function RecepcionPage() {
    const [msg, setMsg] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Datos maestros
    const [pacientesList, setPacientesList] = useState<UIUser[]>([]);
    const [profesionales, setProfesionales] = useState<UIProfessional[]>([]);
    const [services, setServices] = useState<ProfessionalService[]>([]);

    // Estado del calendario (Eventos)
    // Usamos 'any[]' para que coincida con la estructura de eventos de FullCalendar
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

    // Estados de UI y búsqueda
    const [isRegistering, setIsRegistering] = useState(false);
    const [filterText, setFilterText] = useState("");
    const [slots, setSlots] = useState<string[]>([]); // Slots disponibles para creación manual

    // Estado Formulario Nuevo Turno
    const [newAppointment, setNewAppointment] = useState({
        pacienteId: "",
        profesionalEmail: "",
        serviceName: "",
        date: new Date().toISOString().split('T')[0],
        time: "", // Almacena el ISO string del slot seleccionado
    });

    // Filtro de pacientes (Buscador)
    const filteredPacientesList = useMemo(() => {
        if (!filterText) return pacientesList;
        const normalizedSearch = removeAccents(filterText.toLowerCase());
        return pacientesList.filter(p => {
            const normalizedNombre = removeAccents(p.nombre.toLowerCase());
            const normalizedApellido = removeAccents(p.apellido.toLowerCase());
            const normalizedDni = removeAccents(p.dni.toLowerCase());
            const fullNormalizedName = `${normalizedNombre} ${normalizedApellido}`;
            return (
                fullNormalizedName.includes(normalizedSearch) ||
                normalizedDni.includes(normalizedSearch) ||
                p.email.includes(normalizedSearch)
            );
        });
    }, [pacientesList, filterText]);


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

    // Carga inicial: Pacientes y Profesionales (NO Turnos, eso lo maneja el calendario)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                await fetchPacientes();
                const rProf = await fetch("/api/paciente/profesionales");
                const dProf = await rProf.json();
                setProfesionales(dProf.professionals || []);
            } catch (e) {
                console.error(e);
                setMsg("Error al cargar datos iniciales");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [fetchPacientes]);

    // Lógica del Calendario: Cargar turnos cuando cambia el rango visible
    const handleDatesSet = async (arg: any) => {
        const startISO = arg.start.toISOString();
        const endISO = arg.end.toISOString();

        // Usamos un flag de loading local o global si queremos mostrar spinner sobre el calendario
        // Por ahora usamos console para debug o el loading global si es muy lento
        // setLoading(true); 

        try {
            const qs = new URLSearchParams({
                from: startISO,
                to: endISO
                // Aquí se podrían agregar filtros globales de profesional si existieran en la UI
            });

            const r = await fetch(`/api/appointments/list?${qs.toString()}`);
            const { ok, data } = await safeJson<ListResp>(r);

            if (ok && data?.appointments) {
                const mappedEvents = data.appointments.map((a: any) => ({
                    id: a.id,
                    start: a.startAt,
                    end: a.endAt,
                    // extendedProps guarda la data para el renderizado custom
                    extendedProps: {
                        patientName: a.patientName,
                        professionalName: a.professionalName,
                        serviceName: a.serviceName,
                        isPaid: a.paymentStatus === 'PAID',
                        estado: a.estado
                    },
                    // Propiedades estándar de fallback (aunque usamos renderEventContent)
                    title: a.patientName,
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    textColor: 'black',
                    classNames: ['cursor-pointer'] // Clase para indicar clic
                }));
                setCalendarEvents(mappedEvents);
            }
        } catch (e) {
            console.error("Error cargando rango calendario", e);
        } finally {
            // setLoading(false);
        }
    };


    // Cargar servicios y slots para el formulario manual
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


    // Acción: Crear Turno Manual
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
                // Forzamos refresco del calendario simulando un cambio de fecha o recargando la página si es necesario
                // Una forma simple es disparar de nuevo handleDatesSet si tuviéramos acceso a la ref del calendario, 
                // pero recargar la página o limpiar el form es buen feedback inmediato.
                setNewAppointment({ ...newAppointment, time: "" });
                // Nota: El calendario no se actualiza automáticamente aquí a menos que refetchees. 
                // Como handleDatesSet depende del estado interno de FullCalendar, lo ideal sería refetchear manualmente.
                // Por simplicidad en este MVP, el usuario verá el turno si navega o refresca.
                window.location.reload();
            } else {
                setMsg(res.error || "Error al crear turno");
            }
        } catch (e) {
            setMsg("Error de conexión");
        }
    };

    // Configuración de localización para FullCalendar
    const localeEs = {
        code: 'es',
        week: { dow: 1, doy: 4 }, // Lunes primer día
        buttonText: { prev: 'Ant', next: 'Sig', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Agenda' },
        weekText: 'Sm', allDayText: 'Todo el día', moreLinkText: 'más', noEventsText: 'No hay eventos para mostrar'
    };

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
                            <option value="">{newAppointment.date && (!newAppointment.profesionalEmail || !newAppointment.serviceName) ? "Faltan datos" : slots.length === 0 ? "Sin horarios" : "-- Elegir --"}</option>

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

            {/* 2. GESTIÓN DE PACIENTES */}
            <section className="card">
                <h2 className="h2 mb-4">Gestión de Pacientes</h2>
                <p className="text-sm text-muted mb-3">Haga clic en un paciente para ver su perfil completo.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
                    {pacientesList.slice(0, 12).map(p => (
                        <div
                            key={p.id}
                            className="card p-3 hover:bg-gray-50 cursor-pointer border border-transparent hover:border-brand-primary transition"
                            onClick={() => handleViewProfile(p.id)}
                        >
                            <p className="font-medium">{p.nombre} {p.apellido}</p>
                            <p className="text-sm text-muted">DNI: {p.dni || 'N/A'}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 3. CALENDARIO SEMANAL MEJORADO */}
            <section className="card overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="h2">Agenda Semanal</h2>
                    <div className="flex gap-4 text-xs bg-gray-50 p-2 rounded-lg">
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500"></div> Pagado</span>
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Pendiente</span>
                    </div>
                </div>

                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    locale={localeEs}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    // PROPIEDAD CLAVE: Carga turnos según el rango visible
                    datesSet={handleDatesSet}
                    events={calendarEvents}
                    // Renderizado Personalizado (Bloques ricos)
                    eventContent={renderEventContent}

                    height="auto"
                    slotMinTime="08:00:00"
                    slotMaxTime="21:00:00"
                    allDaySlot={false}
                    slotDuration="00:15:00" // Slots de 15 minutos
                    eventClick={(info) => {
                        // Acción al hacer click en el evento
                        const props = info.event.extendedProps;
                        const msg = `Turno: ${props.patientName}\nServicio: ${props.serviceName}\nEstado Pago: ${props.isPaid ? "PAGADO" : "PENDIENTE"}`;
                        alert(msg);
                        // Aquí podrías redirigir a la página de pagos o abrir un modal de detalle
                    }}
                />
            </section>
        </div>
    );
}