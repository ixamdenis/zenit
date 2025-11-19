"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Definiciones de tipos
interface ProfessionalPublicData {
    nombreCompleto: string;
    especialidad: string | null;
    matriculaProvincial: string | null;
    matriculaNacional: string | null;
    email: string;
    availabilities: Record<number, string[]>;
    services: {
        id: string;
        nombre: string;
        duracionMin: number;
        precioBase: number;
    }[];
}

interface SlotsResp { slots: string[]; error?: string }

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function toYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}
async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}

export default function ProfessionalPublicProfilePage() {
    const router = useRouter();
    const params = useParams();
    // Extraer el ID de forma robusta
    const professionalId = Array.isArray(params.id) ? params.id[0] : params.id;

    const todayISO = useMemo(() => toYMD(new Date()), []);

    const [profile, setProfile] = useState<ProfessionalPublicData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string>("");

    // Estados de reserva
    const [selectedServiceId, setSelectedServiceId] = useState<string>("");
    const [date, setDate] = useState(todayISO);
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState("");
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [creating, setCreating] = useState(false);

    // Carga de perfil y servicios
    useEffect(() => {
        // --- GUARDIA CLAVE: Solo cargar si el ID es un string válido y no vacío ---
        if (!professionalId || typeof professionalId !== 'string' || professionalId.length === 0) {
            setLoading(false); // Detenemos el spinner si no hay ID
            return;
        }
        // --------------------------------------------------------------------------

        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                // Aquí el professionalId ya está garantizado como un string válido
                const r = await fetch(`/api/profesional/public-perfil/${professionalId}`);
                const { professional, error: apiError } = await r.json();

                if (!r.ok || apiError) {
                    throw new Error(apiError || "Error al cargar el perfil.");
                }

                setProfile(professional);
                // Pre-seleccionar el primer servicio
                if (professional.services.length > 0) {
                    setSelectedServiceId(professional.services[0].id);
                }

            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [professionalId]);

    const selectedService = profile?.services.find(s => s.id === selectedServiceId);

    // Carga de Horarios (Slots)
    const loadSlots = async () => {
        if (!profile || !selectedService || !date) { setSlots([]); return; }
        setLoadingSlots(true);
        // Usamos el email del profesional para la API de agenda
        const qs = new URLSearchParams({ date, professionalEmail: profile.email, serviceName: selectedService.nombre });
        const r = await fetch(`/api/agenda?${qs.toString()}`);
        const { ok, data, error } = await safeJson<SlotsResp>(r);
        if (!ok) setMsg(error ?? "Error cargando horarios");
        setSlots(data?.slots ?? []);
        setLoadingSlots(false);
    };

    useEffect(() => {
        setSelectedSlot("");
        loadSlots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedServiceId, date, profile?.email]);

    // Manejo de la reserva
    const handleCreateAppointment = async () => {
        if (!profile || !selectedService || !selectedSlot) return;

        setCreating(true);
        setMsg("");

        const r = await fetch("/api/appointments", {
            method: "POST", headers: { "Content-Type": "application/json" },
            // La API de appointments es inteligente: si es paciente logueado, usa su email.
            body: JSON.stringify({
                professionalEmail: profile.email,
                serviceName: selectedService.nombre,
                startAtISO: selectedSlot
            })
        });
        const { ok, error } = await safeJson<any>(r);

        if (!ok) {
            setMsg(error ?? "Error creando turno");
            setCreating(false);
        } else {
            setMsg("¡Turno reservado! Redirigiendo a Mis Turnos...");
            setTimeout(() => router.push("/paciente"), 2000);
        }
    };


    if (loading) return <div className="p-8 text-center">Cargando perfil profesional...</div>;
    // Si no se pudo cargar el perfil y no hay un error específico, asumimos que no existe.
    if (!profile) return <div className="p-8 text-red-600">Profesional no disponible o ID inválido.</div>;
    if (error) return <div className="p-8 text-red-600">Error: {error}</div>;


    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="h1 border-b pb-2">{profile.nombreCompleto}</h1>

            {msg && <div className="card bg-green-50 text-green-700">{msg}</div>}

            <div className="grid md:grid-cols-2 gap-8">
                {/* Columna de Perfil (Izquierda) */}
                <div className="space-y-6">
                    <div className="card space-y-3">
                        <h2 className="h2 text-brand-primary">Datos del Profesional</h2>
                        <p><strong>Especialidad/Disciplina:</strong> {profile.especialidad || 'N/A'}</p>
                        <p><strong>Matrícula Provincial:</strong> {profile.matriculaProvincial || 'N/A'}</p>
                        <p><strong>Matrícula Nacional:</strong> {profile.matriculaNacional || 'N/A'}</p>
                        <p><strong>Email de Contacto:</strong> {profile.email}</p>
                    </div>

                    <div className="card space-y-3">
                        <h2 className="h2 text-brand-primary">Días y Horarios de Atención</h2>
                        {Object.keys(profile.availabilities).length === 0 ? (
                            <p className="text-muted text-sm">Horarios no publicados.</p>
                        ) : (
                            // Ordenamos y mostramos la disponibilidad
                            Object.keys(profile.availabilities).sort((a, b) => parseInt(a) - parseInt(b)).map(dayIndex => (
                                <p key={dayIndex} className="text-sm">
                                    <strong>{DIAS_SEMANA[parseInt(dayIndex)]}:</strong> {profile.availabilities[parseInt(dayIndex)].join(' y ')}
                                </p>
                            ))
                        )}
                    </div>
                </div>

                {/* Columna de Reserva (Derecha) */}
                <div className="card space-y-4 bg-gray-50 p-6">
                    <h2 className="h2 text-brand-primary">Solicitar Turno</h2>

                    {/* 1. Seleccionar Servicio */}
                    <div>
                        <label className="text-sm font-medium">1. Servicio</label>
                        <select
                            className="input mt-1"
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                        >
                            {profile.services.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.nombre} ({s.duracionMin} min) - ${s.precioBase}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Seleccionar Fecha */}
                    <div>
                        <label className="text-sm font-medium">2. Fecha</label>
                        <input
                            type="date"
                            value={date}
                            min={todayISO}
                            onChange={(e) => setDate(e.target.value)}
                            className="input mt-1"
                            disabled={!selectedService}
                        />
                    </div>

                    {/* 3. Seleccionar Horario */}
                    <div>
                        <label className="text-sm font-medium">3. Horario</label>
                        <select
                            className="input mt-1"
                            value={selectedSlot}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                            disabled={loadingSlots || !slots.length}
                        >
                            <option value="">{loadingSlots ? "Buscando disponibilidad..." : slots.length ? "-- Elegir horario --" : "Sin cupo disponible"}</option>
                            {slots.map(s => <option key={s} value={s}>{new Date(s).getHours()}:{String(new Date(s).getMinutes()).padStart(2, '0')}</option>)}
                        </select>
                    </div>

                    {/* 4. Confirmar */}
                    {selectedService && (
                        <div className="pt-2">
                            <p className="text-lg font-bold text-gray-800">Costo total: ${selectedService.precioBase}</p>
                        </div>
                    )}


                    <button
                        onClick={handleCreateAppointment}
                        disabled={creating || !selectedSlot}
                        className="btn btn-primary w-full"
                    >
                        {creating ? "Reservando..." : "Confirmar Reserva"}
                    </button>

                    <Link href="/paciente/solicitar" className="text-sm text-center block pt-2 text-brand-primary hover:underline">
                        Ver otros profesionales
                    </Link>
                </div>
            </div>
        </div>
    );
}