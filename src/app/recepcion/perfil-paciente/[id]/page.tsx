"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PatientProfileData {
    id: string;
    nombre: string;
    apellido: string;
    dni: string;
    telefono: string;
    fechaNacimiento: string;
    localidad: string;
    tieneObraSocial: boolean | null;
    obraSocialNombre: string | null;
    userEmail: string;
    isDNIUser: boolean;
    userCreatedAt: string;
    telefonoEmergencia: string | null; // Campo nuevo
}

export default function PatientProfilePage() {
    const params = useParams();
    const patientId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [profile, setProfile] = useState<PatientProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientId || typeof patientId !== 'string' || patientId.length === 0) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const r = await fetch(`/api/paciente/perfil/${patientId}`);
                const { patient, error: apiError } = await r.json();

                if (!r.ok || apiError) {
                    throw new Error(apiError || "Error al cargar el perfil.");
                }

                setProfile(patient);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [patientId]);

    if (loading) return <div className="p-8 text-center">Cargando perfil del paciente...</div>;
    if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
    if (!profile) return <div className="p-8">Perfil no disponible o ID inválido.</div>;

    const isDNIUserText = profile.isDNIUser ? "Sí (Login con DNI)" : "No (Login con Email)";
    const loginIdentifier = profile.isDNIUser ? profile.dni : profile.userEmail;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="h1">{profile.nombre} {profile.apellido}</h1>
            <p className="text-sm text-muted">
                Registrado desde: {new Date(profile.userCreatedAt).toLocaleDateString()}
            </p>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Columna 1: Contacto */}
                <div className="space-y-4">
                    <div className="card space-y-3 border-l-4 border-l-brand-primary">
                        <h2 className="h2 border-b pb-2">Contacto</h2>
                        <p><strong>Teléfono:</strong> {profile.telefono || 'N/A'}</p>
                        <p><strong>Email:</strong> {profile.userEmail}</p>
                        <p><strong>Localidad:</strong> {profile.localidad || 'N/A'}</p>

                        {/* Dato de emergencia resaltado */}
                        <div className="mt-4 pt-2 border-t border-red-100">
                            <p className="text-red-800 font-semibold">
                                🚑 Emergencia: <span className="text-black font-normal">{profile.telefonoEmergencia || 'No especificado'}</span>
                            </p>
                        </div>
                    </div>

                    <div className="card space-y-3">
                        <h2 className="h2 border-b pb-2">Datos de Sistema</h2>
                        <p>
                            <strong>Login por DNI:</strong> {isDNIUserText}
                        </p>
                        <p>
                            <strong>Usuario:</strong> {loginIdentifier}
                        </p>
                    </div>
                </div>

                {/* Columna 2: Datos Personales */}
                <div className="space-y-4">
                    <div className="card space-y-3">
                        <h2 className="h2 border-b pb-2">Información Personal</h2>
                        <p><strong>DNI:</strong> {profile.dni || 'N/A'}</p>
                        <p><strong>Fecha Nac.:</strong> {profile.fechaNacimiento ? new Date(profile.fechaNacimiento).toLocaleDateString() : 'N/A'}</p>
                        <p>
                            <strong>Obra Social:</strong> {profile.tieneObraSocial ? profile.obraSocialNombre || 'Sí, nombre no especificado' : 'No'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-start">
                <Link href="/recepcion" className="btn btn-outline">Volver a Recepción</Link>
            </div>
        </div>
    );
}