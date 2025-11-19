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
}

export default function PatientProfilePage() {
    const params = useParams();
    const patientId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [profile, setProfile] = useState<PatientProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // --- GUARDIA CLAVE: Sólo cargar si el ID es un string válido y no vacío ---
        if (!patientId || typeof patientId !== 'string' || patientId.length === 0) {
            // Si no hay ID, detenemos el loading y salimos para evitar la llamada prematura
            setLoading(false);
            return;
        }
        // --------------------------------------------------------------------------

        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                // Aquí el patientId ya está garantizado como un string válido
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

            <div className="card space-y-4">
                <h2 className="h2 border-b pb-2">Datos de Contacto y Login</h2>
                <p><strong>Email:</strong> {profile.userEmail}</p>
                <p><strong>DNI:</strong> {profile.dni || 'N/A'}</p>
                <p><strong>Teléfono:</strong> {profile.telefono || 'N/A'}</p>
                <p>
                    <strong>Login por DNI:</strong> {isDNIUserText}
                    <span className="badge ml-2 bg-blue-100 text-blue-800">
                        Usuario: {loginIdentifier}
                    </span>
                </p>
            </div>

            <div className="card space-y-4">
                <h2 className="h2 border-b pb-2">Información Médica y Personal</h2>
                <p><strong>Fecha Nac.:</strong> {profile.fechaNacimiento ? new Date(profile.fechaNacimiento).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Localidad:</strong> {profile.localidad || 'N/A'}</p>
                <p>
                    <strong>Obra Social:</strong> {profile.tieneObraSocial ? profile.obraSocialNombre || 'Sí, nombre no especificado' : 'No'}
                </p>
            </div>

            <div className="flex justify-start">
                <Link href="/recepcion" className="btn btn-outline">Volver a Recepción</Link>
            </div>
        </div>
    );
}