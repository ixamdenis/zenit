"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Importamos los Roles
enum Role {
    ADMIN = "ADMIN",
    RECEPCION = "RECEPCION",
    PROFESIONAL = "PROFESIONAL",
    PACIENTE = "PACIENTE",
}

export default function RegisterPage() {
    const router = useRouter();
    const [nombre, setNombre] = useState("");
    const [apellido, setApellido] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<Role>(Role.PACIENTE);
    const [zenitCode, setZenitCode] = useState(""); // <-- Nuevo estado
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        if (!nombre || !apellido || !email || !password) {
            setMsg("Por favor, completa todos los campos.");
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
                    nombre,
                    apellido,
                    email,
                    password,
                    role,
                    zenitCode // <-- Enviamos el código
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
        <div className="max-w-md mx-auto">
            <div className="card">
                <h1 className="h1 mb-4 text-center">Crear una cuenta</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
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

                    {/* --- Campo Condicional --- */}
                    {role === Role.PROFESIONAL && (
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
                    )}
                    {/* --- Fin Campo Condicional --- */}

                    <button type="submit" disabled={loading} className="btn btn-primary w-full">
                        {loading ? "Registrando..." : "Registrarme"}
                    </button>
                </form>

                {msg && (
                    <div className="mt-4 text-center text-sm">
                        {msg}
                    </div>
                )}
            </div>
        </div>
    );
}