// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

enum Role {
    ADMIN = "ADMIN",
    RECEPCION = "RECEPCION",
    PROFESIONAL = "PROFESIONAL",
    PACIENTE = "PACIENTE",
}

export default function RegisterPage() {
    const router = useRouter();

    // --- Datos de User ---
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<Role>(Role.PACIENTE);

    // --- Datos de Perfil (Comunes) ---
    const [nombre, setNombre] = useState("");
    const [apellido, setApellido] = useState("");
    const [fechaNacimiento, setFechaNacimiento] = useState("");

    // --- Datos de Paciente ---
    const [dni, setDni] = useState("");
    const [telefono, setTelefono] = useState(""); // Se usa para Paciente y ahora Profesional
    const [localidad, setLocalidad] = useState("");
    const [tieneObraSocial, setTieneObraSocial] = useState(false);
    const [obraSocialNombre, setObraSocialNombre] = useState("");
    const [hasNoEmail, setHasNoEmail] = useState(false);

    // --- Datos de Profesional ---
    const [especialidad, setEspecialidad] = useState("");
    const [matriculaProvincial, setMatriculaProvincial] = useState("");
    const [matriculaNacional, setMatriculaNacional] = useState("");
    const [aliasBancario, setAliasBancario] = useState("");
    const [zenitCode, setZenitCode] = useState("");

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        if (!nombre || !apellido || !password || !role) {
            setMsg("Por favor, completa los campos básicos.");
            setLoading(false);
            return;
        }

        if (role === Role.PACIENTE && !dni) {
            setMsg("El DNI es obligatorio para pacientes.");
            setLoading(false);
            return;
        }

        // Validación para Profesional
        if (role === Role.PROFESIONAL) {
            if (!zenitCode) {
                setMsg("Código Zenit requerido.");
                setLoading(false);
                return;
            }
            if (!telefono) {
                setMsg("El teléfono es obligatorio para el registro profesional.");
                setLoading(false);
                return;
            }
        }

        try {
            const res = await fetch("/api/auth/crear-cuenta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: hasNoEmail ? "" : email,
                    password,
                    role,
                    hasNoEmail,
                    nombre,
                    apellido,
                    fechaNacimiento: fechaNacimiento || null,
                    dni,
                    telefono, // Se envía para ambos roles
                    localidad,
                    tieneObraSocial,
                    obraSocialNombre: tieneObraSocial ? obraSocialNombre : null,
                    especialidad,
                    matriculaProvincial,
                    matriculaNacional,
                    aliasBancario,
                    zenitCode
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setMsg(data.error || "Error al registrar.");
            } else {
                setMsg("¡Registrado con éxito! Redirigiendo...");
                setTimeout(() => router.push("/login"), 2000);
            }
        } catch (error) {
            setMsg("Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto pt-12 pb-12">
            <Link href="/" className="flex justify-center mb-6">
                <Image src="/zenit-logo@2x.png" alt="Zenit" width={80} height={80} className="w-20 h-auto" priority />
            </Link>

            <div className="card">
                <h1 className="h1 mb-4 text-center">Crear una cuenta</h1>
                <form onSubmit={handleSubmit} className="space-y-4">

                    <div>
                        <label className="block text-sm font-medium">Quiero registrarme como</label>
                        <select
                            value={role}
                            onChange={(e) => {
                                setRole(e.target.value as Role);
                                setHasNoEmail(false);
                                setEmail("");
                            }}
                            className="input mt-1"
                        >
                            <option value={Role.PACIENTE}>Paciente</option>
                            <option value={Role.PROFESIONAL}>Profesional</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Nombre</label>
                            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Apellido</label>
                            <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} className="input mt-1" />
                        </div>
                    </div>

                    {(role !== Role.PACIENTE || !hasNoEmail) && (
                        <div>
                            <label className="block text-sm font-medium">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input mt-1"
                                required={!hasNoEmail}
                                disabled={hasNoEmail}
                            />
                        </div>
                    )}

                    {role === Role.PACIENTE && (
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="noEmailCheck" checked={hasNoEmail} onChange={(e) => { setHasNoEmail(e.target.checked); if (e.target.checked) setEmail(""); }} className="h-4 w-4" />
                            <label htmlFor="noEmailCheck" className="text-sm font-medium">No tiene email (Usar DNI)</label>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium">Contraseña</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Fecha de Nacimiento</label>
                        <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="input mt-1" />
                    </div>

                    {/* --- PACIENTE --- */}
                    {role === Role.PACIENTE && (
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">DNI *</label><input type="text" value={dni} onChange={(e) => setDni(e.target.value)} className="input mt-1" required /></div>
                                <div><label className="block text-sm font-medium">Teléfono</label><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input mt-1" /></div>
                            </div>
                            <div><label className="block text-sm font-medium">Localidad</label><input type="text" value={localidad} onChange={(e) => setLocalidad(e.target.value)} className="input mt-1" /></div>

                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="obraSocialCheck" checked={tieneObraSocial} onChange={(e) => setTieneObraSocial(e.target.checked)} className="h-4 w-4" />
                                <label htmlFor="obraSocialCheck" className="text-sm font-medium">Tengo Obra Social</label>
                            </div>
                            {tieneObraSocial && (
                                <div><label className="block text-sm font-medium">Nombre Obra Social</label><input type="text" value={obraSocialNombre} onChange={(e) => setObraSocialNombre(e.target.value)} className="input mt-1" /></div>
                            )}
                        </div>
                    )}

                    {/* --- PROFESIONAL --- */}
                    {role === Role.PROFESIONAL && (
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <h2 className="font-semibold">Datos Profesionales</h2>
                            {/* NUEVO CAMPO: TELEFONO PROFESIONAL */}
                            <div>
                                <label className="block text-sm font-medium">Teléfono de Contacto *</label>
                                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input mt-1" placeholder="Para uso administrativo" required />
                            </div>

                            <div><label className="block text-sm font-medium">Especialidad</label><input type="text" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} className="input mt-1" /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">Mat. Prov.</label><input type="text" value={matriculaProvincial} onChange={(e) => setMatriculaProvincial(e.target.value)} className="input mt-1" /></div>
                                <div><label className="block text-sm font-medium">Mat. Nac.</label><input type="text" value={matriculaNacional} onChange={(e) => setMatriculaNacional(e.target.value)} className="input mt-1" /></div>
                            </div>
                            <div><label className="block text-sm font-medium">Alias Bancario</label><input type="text" value={aliasBancario} onChange={(e) => setAliasBancario(e.target.value)} className="input mt-1" /></div>

                            <div>
                                <label className="block text-sm font-medium">Código Zenit</label>
                                <input type="text" value={zenitCode} onChange={(e) => setZenitCode(e.target.value)} className="input mt-1" required />
                            </div>
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn btn-primary w-full">
                        {loading ? "Registrando..." : "Registrarme"}
                    </button>
                </form>
                {msg && <div className="mt-4 text-center text-sm text-red-600">{msg}</div>}
                <div className="mt-6 text-center text-sm">
                    ¿Ya tienes una cuenta? <Link href="/login" className="text-brand-primary hover:underline">Inicia sesión</Link>
                </div>
            </div>
        </div>
    );
}