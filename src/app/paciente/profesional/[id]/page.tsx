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
    aliasBancario: string | null; // <-- Agregado
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

// Formateo de fecha para mostrar al usuario (ej: 19/11 18:20hs)
function formatDisplayDate(dateStr: string, slotISO: string) {
    if (!dateStr || !slotISO) return "";
    const d = new Date(slotISO);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}hs`;
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

    // Estado para controlar el paso de confirmación
    const [step, setStep] = useState<"SELECTION" | "CONFIRMATION">("SELECTION");

    // Carga de perfil y servicios
    useEffect(() => {
        if (!professionalId || typeof professionalId !== 'string' || professionalId.length === 0) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const r = await fetch(`/api/profesional/public-perfil/${professionalId}`);
                const { professional, error: apiError } = await r.json();

                if (!r.ok || apiError) {
                    throw new Error(apiError || "Error al cargar el perfil.");
                }

                setProfile(professional);
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

    // --- Paso 1: Ir a Confirmación ---
    const handleGoToConfirmation = () => {
        if (!selectedSlot || !selectedService) {
            setMsg("Por favor selecciona un horario.");
            return;
        }
        setStep("CONFIRMATION");
        setMsg(""); // Limpiar mensajes previos
    };

    // --- Paso 2: Confirmar Reserva Real ---
    const handleCreateAppointment = async () => {
        if (!profile || !selectedService || !selectedSlot) return;

        setCreating(true);
        setMsg("");

        const r = await fetch("/api/appointments", {
            method: "POST", headers: { "Content-Type": "application/json" },
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
    if (!profile) return <div className="p-8 text-red-600">Profesional no disponible.</div>;
    if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

    // -------------------------------------------------------------------------
    // VISTA: CONFIRMACIÓN (Paso 2)
    // -------------------------------------------------------------------------
    if (step === "CONFIRMATION" && selectedService) {
        const depositAmount = selectedService.precioBase / 2; // 50% seña
        const whatsappNumber = "5492920593967";
        const whatsappDisplay = "2920-593967";
        // Texto predefinido para WhatsApp
        const waText = `Hola, soy [Mi Nombre], envío comprobante para el turno del ${formatDisplayDate(date, selectedSlot)} con ${profile.nombreCompleto}.`;
        const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waText)}`;

        return (
            <div className="max-w-2xl mx-auto space-y-6 pt-4">
                <h1 className="h1 text-center mb-6">Confirmar Turno</h1>

                {/* Tarjeta de Resumen */}
                <div className="card bg-gray-50 border-gray-200 p-6 space-y-3">
                    <p><strong>Profesional:</strong> {profile.nombreCompleto}</p>
                    <p><strong>Servicio:</strong> {selectedService.nombre}</p>
                    <p><strong>Fecha:</strong> {formatDisplayDate(date, selectedSlot)}</p>
                    <p className="text-xl font-bold mt-2">Total: ${selectedService.precioBase}</p>
                </div>

                {/* Tarjeta de Pago Requerido */}
                <div className="card bg-amber-50 border-amber-200 p-6 space-y-4">
                    <h2 className="text-lg font-bold text-amber-900">Pago Requerido (Seña 50%)</h2>

                    <div className="text-sm text-amber-900 space-y-2">
                        <p>Para confirmar, debes transferir <strong>${depositAmount}</strong> a:</p>

                        {profile.aliasBancario ? (
                            <div className="p-3 bg-white rounded border border-amber-200 font-mono text-center text-lg select-all cursor-pointer" onClick={() => navigator.clipboard.writeText(profile.aliasBancario!)}>
                                {profile.aliasBancario}
                            </div>
                        ) : (
                            <div className="p-3 bg-white rounded border border-amber-200 italic text-center text-muted">
                                (El profesional no cargó Alias. Consultar por WhatsApp)
                            </div>
                        )}

                        <p className="mt-4">
                            Enviar comprobante por WhatsApp al <strong className="whitespace-nowrap">{whatsappDisplay}</strong>.
                            <br />El turno será confirmado a la brevedad por esa vía.
                        </p>

                        {/* Botón WhatsApp */}
                        <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn w-full mt-2 flex justify-center items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                            </svg>
                            Enviar comprobante
                        </a>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleCreateAppointment}
                        disabled={creating}
                        className="btn btn-primary w-full h-12 text-lg shadow-lg"
                    >
                        {creating ? "Reservando..." : "Confirmar Reserva"}
                    </button>

                    <button
                        onClick={() => setStep("SELECTION")}
                        className="btn btn-outline w-full border-none text-muted hover:underline"
                    >
                        Volver / Corregir
                    </button>
                </div>

                {msg && <div className="card bg-red-50 text-red-700 text-center p-4">{msg}</div>}
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // VISTA: SELECCIÓN (Paso 1 - Original)
    // -------------------------------------------------------------------------
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="h1 border-b pb-2">{profile.nombreCompleto}</h1>

            {msg && <div className="card bg-green-50 text-green-700">{msg}</div>}

            <div className="grid md:grid-cols-2 gap-8">
                {/* Columna de Perfil (Izquierda) */}
                <div className="space-y-6">
                    <div className="card space-y-3">
                        <h2 className="h2 text-brand-primary">Datos del Profesional</h2>
                        <p><strong>Especialidad:</strong> {profile.especialidad || 'N/A'}</p>
                        <p><strong>Matrícula:</strong> {profile.matriculaProvincial || 'N/A'} / {profile.matriculaNacional || 'N/A'}</p>
                        <p><strong>Email:</strong> {profile.email}</p>
                    </div>

                    <div className="card space-y-3">
                        <h2 className="h2 text-brand-primary">Días y Horarios</h2>
                        {Object.keys(profile.availabilities).length === 0 ? (
                            <p className="text-muted text-sm">Horarios no publicados.</p>
                        ) : (
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

                    <div>
                        <label className="text-sm font-medium">3. Horario</label>
                        <select
                            className="input mt-1"
                            value={selectedSlot}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                            disabled={loadingSlots || !slots.length}
                        >
                            <option value="">{loadingSlots ? "Buscando..." : slots.length ? "-- Elegir horario --" : "Sin cupo"}</option>
                            {slots.map(s => <option key={s} value={s}>{new Date(s).getHours()}:{String(new Date(s).getMinutes()).padStart(2, '0')}</option>)}
                        </select>
                    </div>

                    {selectedService && (
                        <div className="pt-2">
                            <p className="text-lg font-bold text-gray-800">Costo total: ${selectedService.precioBase}</p>
                        </div>
                    )}

                    {/* Botón CAMBIADO: Ahora va a confirmar, no crea directo */}
                    <button
                        onClick={handleGoToConfirmation}
                        disabled={!selectedSlot}
                        className="btn btn-primary w-full"
                    >
                        Continuar
                    </button>

                    <Link href="/paciente/solicitar" className="text-sm text-center block pt-2 text-brand-primary hover:underline">
                        Ver otros profesionales
                    </Link>
                </div>
            </div>
        </div>
    );
}