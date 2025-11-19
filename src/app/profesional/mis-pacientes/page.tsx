// src/app/profesional/mis-pacientes/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";

interface PatientListItem {
    id: string; // PatientProfile ID
    nombre: string;
    apellido: string;
    dni: string | null;
    email: string;
    nombreCompleto: string;
}

// Función para remover acentos (para búsqueda)
const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export default function ProfesionalMisPacientesPage() {
    const [allPatients, setAllPatients] = useState<PatientListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterText, setFilterText] = useState("");

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch("/api/profesional/mis-pacientes");
            const data = await r.json();

            if (!r.ok) {
                throw new Error(data.error || "Error al cargar la lista.");
            }

            setAllPatients(data.patients || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const filteredPatients = useMemo(() => {
        if (!filterText) return allPatients;

        const normalizedSearch = removeAccents(filterText.toLowerCase());

        return allPatients.filter(p => {
            const normalizedNombreCompleto = removeAccents(p.nombreCompleto.toLowerCase());
            const normalizedDni = removeAccents(p.dni?.toLowerCase() || "");
            const normalizedEmail = removeAccents(p.email.toLowerCase());

            return (
                normalizedNombreCompleto.includes(normalizedSearch) ||
                normalizedDni.includes(normalizedSearch) ||
                normalizedEmail.includes(normalizedSearch)
            );
        });
    }, [allPatients, filterText]);

    if (loading) return <div className="p-8 text-center">Cargando mis pacientes...</div>;
    if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="h1">Mis Pacientes</h1>
            <p className="text-muted">Aquí se muestran todos los pacientes que has atendido.</p>

            <section className="card space-y-4">
                <input
                    type="text"
                    className="input"
                    placeholder="Buscar por Nombre, Apellido, DNI o Email..."
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredPatients.length === 0 ? (
                        <p className="text-muted col-span-2">
                            {filterText ? "No hay coincidencias." : "Aún no has atendido pacientes."}
                        </p>
                    ) : (
                        filteredPatients.map(p => (
                            <Link
                                key={p.id}
                                // Reutilizamos la ruta de perfil de Recepción
                                href={`/recepcion/perfil-paciente/${p.id}`}
                                className="card p-3 flex justify-between items-center hover:bg-gray-50 transition border border-transparent hover:border-brand-primary"
                            >
                                <div>
                                    <p className="font-medium">{p.apellido}, {p.nombre}</p>
                                    <p className="text-sm text-muted">DNI: {p.dni || 'N/A'}</p>
                                </div>
                                <span className="text-sm text-brand-primary">Ver Perfil &rarr;</span>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}