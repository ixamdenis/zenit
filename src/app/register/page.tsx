"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

// Importamos los Roles
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
    const [telefono, setTelefono] = useState("");
    const [localidad, setLocalidad] = useState("");
    const [tieneObraSocial, setTieneObraSocial] = useState(false);
    const [obraSocialNombre, setObraSocialNombre] = useState("");

    // --- Datos de Profesional ---
    const [especialidad, setEspecialidad] = useState("");
    const [matriculaProvincial, setMatriculaProvincial] = useState("");
    const [matriculaNacional, setMatriculaNacional] = useState("");
    const [aliasBancario, setAliasBancario] = useState("");
    const [zenitCode, setZenitCode] = useState("");

    // --- Estados de UI ---
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        if (!nombre || !apellido || !email || !password) {
            setMsg("Por favor, completa los campos básicos (Nombre, Apellido, Email, Contraseña).");
            setLoading(false);
            return;
        }

        // Validación extra si es profesional
        if (role === Role.PROFESIONAL && !zenitCode) {
            setMsg("Debes ingresar un código Zenit para registrarte como profesional.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/crear-cuenta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // User
                    email,
                    password,
                    role,
                    // Perfil (común)
                    nombre,
                    apellido,
                    fechaNacimiento: fechaNacimiento || null, // Enviar null si está vacío
                    // Paciente
                    dni,
                    telefono,
                    localidad,
                    tieneObraSocial,
                    obraSocialNombre: tieneObraSocial ? obraSocialNombre : null,
                    // Profesional
                    especialidad,
                    matriculaProvincial,
                    matriculaNacional,
                    aliasBancario,
                    // Código
                    zenitCode
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setMsg(data.error || "No se pudo registrar.");
            } else {
                setMsg("¡Registrado con éxito! Redirigiendo al login...");
                setTimeout(() => router.push("/login"), 2000);
            }
        } catch (error) {
            setMsg("Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto pt-12">
            <Link href="/" className="flex justify-center mb-6" aria-label="Ir al inicio">
                <Image
                    src="/zenit-logo@2x.png"
                    alt="Zenit"
                    width={80}
                    height={80}
                    className="w-20 h-auto"
                    priority
                />
            </Link>

            <div className="card">
                <h1 className="h1 mb-4 text-center">Crear una cuenta</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* --- Sección 1: Rol --- */}
                    <div>
                        <label className="block text-sm font-medium">Quiero registrarme como</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as Role)}
                            className="input mt-1"
                        >
                            <option value={Role.PACIENTE}>Paciente</option>
                            <option value={Role.PROFESIONAL}>Profesional</option>
                        </select>
                    </div>

                    {/* --- Sección 2: Datos Comunes (User y Perfil) --- */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Nombre</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="input mt-1"
                                placeholder="Juan"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Apellido</label>
                            <input
                                type="text"
                                value={apellido}
                                onChange={(e) => setApellido(e.target.value)}
                                className="input mt-1"
                                placeholder="Pérez"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input mt-1"
                            placeholder="juan@correo.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input mt-1"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Fecha de Nacimiento</label>
                        <input
                            type="date"
                            value={fechaNacimiento}
                            onChange={(e) => setFechaNacimiento(e.target.value)}
                            className="input mt-1"
                        />
                    </div>

                    {/* --- Sección 3: Campos de Paciente --- */}
                    {role === Role.PACIENTE && (
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <h2 className="font-semibold">Completar perfil de Paciente</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">DNI</label>
                                    <input
                                        type="text"
                                        value={dni}
                                        onChange={(e) => setDni(e.target.value)}
                                        className="input mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        className="input mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Localidad</label>
                                <input
                                    type="text"
                                    value={localidad}
                                    onChange={(e) => setLocalidad(e.target.value)}
                                    className="input mt-1"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="obraSocialCheck"
                                    checked={tieneObraSocial}
                                    onChange={(e) => setTieneObraSocial(e.target.checked)}
                                    className="h-4 w-4 rounded"
                                />
                                <label htmlFor="obraSocialCheck" className="text-sm font-medium">Tengo Obra Social</label>
                            </div>

                            {tieneObraSocial && (
                                <div>
                                    <label className="block text-sm font-medium">Nombre Obra Social</label>
                                    <input
                                        type="text"
                                        value={obraSocialNombre}
                                        onChange={(e) => setObraSocialNombre(e.target.value)}
                                        className="input mt-1"
                                        placeholder="Ej: OSDE"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- Sección 4: Campos de Profesional --- */}
                    {role === Role.PROFESIONAL && (
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <h2 className="font-semibold">Completar perfil de Profesional</h2>
                            <div>
                                <label className="block text-sm font-medium">Especialidad</label>
                                <input
                                    type="text"
                                    value={especialidad}
                                    onChange={(e) => setEspecialidad(e.target.value)}
                                    className="input mt-1"
                                    placeholder="Ej: Psicología"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Matrícula Provincial</label>
                                    <input
                                        type="text"
                                        value={matriculaProvincial}
                                        onChange={(e) => setMatriculaProvincial(e.target.value)}
                                        className="input mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Matrícula Nacional</label>
                                    <input
                                        type="text"
                                        value={matriculaNacional}
                                        onChange={(e) => setMatriculaNacional(e.target.value)}
                                        className="input mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Alias Bancario (CVU/CBU)</label>
                                <input
                                    type="text"
                                    value={aliasBancario}
                                    onChange={(e) => setAliasBancario(e.target.value)}
                                    className="input mt-1"
                                    placeholder="mi.alias.mp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Código Zenit</label>
                                <input
                                    type="text"
                                    value={zenitCode}
                                    onChange={(e) => setZenitCode(e.target.value)}
                                    className="input mt-1"
                                    placeholder="Código de registro"
                                />
                                <p className="text-xs text-muted mt-1">
                                    Necesitas un código de registro de Zenit para crear una cuenta de profesional.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- Fin Secciones --- */}

                    <button type="submit" disabled={loading} className="btn btn-primary w-full">
                        {loading ? "Registrando..." : "Registrarme"}
                    </button>
                </form>

                {msg && (
                    <div className="mt-4 text-center text-sm">
                        {msg}
                    </div>
                )}

                <div className="mt-6 text-center text-sm">
                    ¿Ya tienes una cuenta?{" "}
                    <Link href="/login" className="text-brand-primary hover:underline">
                        Inicia sesión aquí
                    </Link>
                </div>
            </div>
        </div>
    );
}