"use client";

import { useState, useEffect } from "react";

interface AdminEditUserModalProps {
    isOpen: boolean;
    user: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AdminEditUserModal({ isOpen, user, onClose, onSuccess }: AdminEditUserModalProps) {
    const isCreating = !user;
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        role: "PACIENTE", // Default para crear
        nombre: "",
        apellido: "",
        dni: "",
        telefono: "",
        direccion: "",
        localidad: "",
        aliasCbu: "",
        especialidad: "",
        matriculaProvincial: "",
        matriculaNacional: "",
        obraSocialNombre: "",
        aliasBancario: "",
        fechaNacimiento: "",
        telefonoEmergencia: "", // Nuevo campo para Paciente
    });

    useEffect(() => {
        if (isOpen) {
            setMsg("");
            if (user) {
                // MODO EDICIÓN
                const p = user.patient || {};
                const pr = user.prof || {};
                const r = user.recep || {};

                // Formatear fecha para input date
                let fechaRaw = p.fechaNacimiento || pr.fechaNacimiento || "";
                if (fechaRaw) {
                    try {
                        fechaRaw = new Date(fechaRaw).toISOString().split('T')[0];
                    } catch { fechaRaw = ""; }
                }

                setFormData({
                    email: user.email || "",
                    password: "",
                    role: user.role,
                    nombre: p.nombre || pr.nombre || r.nombre || "",
                    apellido: p.apellido || pr.apellido || r.apellido || "",
                    dni: p.dni || r.dni || "",
                    // Telefono: ahora disponible para paciente, recepcion y profesional
                    telefono: p.telefono || r.telefono || pr.telefono || "",
                    direccion: r.direccion || "",
                    localidad: p.localidad || "",
                    aliasCbu: r.aliasCbu || "",
                    especialidad: pr.especialidad || "",
                    matriculaProvincial: pr.matriculaProvincial || "",
                    matriculaNacional: pr.matriculaNacional || "",
                    obraSocialNombre: p.obraSocialNombre || "",
                    aliasBancario: pr.aliasBancario || "",
                    fechaNacimiento: fechaRaw,
                    telefonoEmergencia: p.telefonoEmergencia || "",
                });
            } else {
                // MODO CREACIÓN
                setFormData({
                    email: "", password: "", role: "PACIENTE", nombre: "", apellido: "",
                    dni: "", telefono: "", direccion: "", localidad: "", aliasCbu: "",
                    especialidad: "", matriculaProvincial: "", matriculaNacional: "",
                    obraSocialNombre: "", aliasBancario: "", fechaNacimiento: "",
                    telefonoEmergencia: ""
                });
            }
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        try {
            const method = isCreating ? "POST" : "PUT";
            const body = isCreating
                ? { ...formData }
                : { id: user.id, ...formData };

            const r = await fetch("/api/admin/users", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await r.json();

            if (r.ok) {
                onSuccess();
                onClose();
            } else {
                setMsg(data.error || "Error al guardar");
            }
        } catch (error) {
            setMsg("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    // El rol actual determina qué campos mostrar
    const currentRole = isCreating ? formData.role : user.role;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-bold text-brand-primary">
                        {isCreating ? "Crear Usuario" : `Editar ${formData.nombre}`}
                    </h3>
                    <button onClick={onClose} className="text-sm text-muted hover:text-red-600">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* --- SELECCIÓN DE ROL (Solo Crear) --- */}
                    {isCreating && (
                        <div>
                            <label className="label-xs">Rol</label>
                            <select name="role" value={formData.role} onChange={handleChange} className="input mt-1 bg-brand-primary/5 border-brand-primary">
                                <option value="PACIENTE">Paciente</option>
                                <option value="PROFESIONAL">Profesional</option>
                                <option value="RECEPCION">Recepción / Staff</option>
                                <option value="ADMIN">Super Admin</option>
                            </select>
                        </div>
                    )}

                    {/* --- CREDENCIALES --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label-xs">Email (Login)</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input mt-1" required />
                        </div>
                        {isCreating && (
                            <div>
                                <label className="label-xs">Contraseña</label>
                                <input type="password" name="password" value={formData.password} onChange={handleChange} className="input mt-1" required placeholder="Mínimo 6 caracteres" />
                            </div>
                        )}
                    </div>

                    {/* --- DATOS PERSONALES COMUNES --- */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label-xs">Nombre</label>
                            <input name="nombre" value={formData.nombre} onChange={handleChange} className="input mt-1" required />
                        </div>
                        <div>
                            <label className="label-xs">Apellido</label>
                            <input name="apellido" value={formData.apellido} onChange={handleChange} className="input mt-1" required />
                        </div>
                    </div>

                    {/* --- CAMPOS DINÁMICOS SEGÚN ROL --- */}

                    {/* PACIENTE */}
                    {currentRole === "PACIENTE" && (
                        <div className="bg-gray-50 p-3 rounded border border-gray-100 space-y-3 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="label-xs">DNI</label><input name="dni" value={formData.dni} onChange={handleChange} className="input text-sm" /></div>
                                <div><label className="label-xs">Teléfono</label><input name="telefono" value={formData.telefono} onChange={handleChange} className="input text-sm" /></div>
                            </div>
                            {/* Nuevo campo de emergencia */}
                            <div>
                                <label className="label-xs text-red-700">Teléfono Emergencia</label>
                                <input name="telefonoEmergencia" value={formData.telefonoEmergencia} onChange={handleChange} className="input text-sm border-red-100 focus:border-red-300" placeholder="Contacto de urgencia" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="label-xs">Nacimiento</label><input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} className="input text-sm" /></div>
                                <div><label className="label-xs">Localidad</label><input name="localidad" value={formData.localidad} onChange={handleChange} className="input text-sm" /></div>
                            </div>
                            <div><label className="label-xs">Obra Social</label><input name="obraSocialNombre" value={formData.obraSocialNombre} onChange={handleChange} className="input text-sm" placeholder="Ej: OSDE (dejar vacío si no tiene)" /></div>
                        </div>
                    )}

                    {/* PROFESIONAL */}
                    {currentRole === "PROFESIONAL" && (
                        <div className="bg-blue-50 p-3 rounded border border-blue-100 space-y-3 animate-in fade-in">
                            {/* Teléfono profesional ahora editable */}
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="label-xs">Teléfono</label><input name="telefono" value={formData.telefono} onChange={handleChange} className="input text-sm" /></div>
                                <div><label className="label-xs">Nacimiento</label><input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} className="input text-sm" /></div>
                            </div>
                            <div><label className="label-xs">Especialidad</label><input name="especialidad" value={formData.especialidad} onChange={handleChange} className="input text-sm" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="label-xs">Mat. Prov.</label><input name="matriculaProvincial" value={formData.matriculaProvincial} onChange={handleChange} className="input text-sm" /></div>
                                <div><label className="label-xs">Mat. Nac.</label><input name="matriculaNacional" value={formData.matriculaNacional} onChange={handleChange} className="input text-sm" /></div>
                            </div>
                            <div><label className="label-xs">Alias Bancario (Cobros)</label><input name="aliasBancario" value={formData.aliasBancario} onChange={handleChange} className="input text-sm" /></div>
                        </div>
                    )}

                    {/* RECEPCIÓN / STAFF */}
                    {(currentRole === "RECEPCION" || currentRole === "ADMIN") && (
                        <div className="bg-purple-50 p-3 rounded border border-purple-100 space-y-3 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="label-xs">DNI</label><input name="dni" value={formData.dni} onChange={handleChange} className="input text-sm" /></div>
                                <div><label className="label-xs">Teléfono</label><input name="telefono" value={formData.telefono} onChange={handleChange} className="input text-sm" /></div>
                            </div>
                            <div><label className="label-xs">Dirección</label><input name="direccion" value={formData.direccion} onChange={handleChange} className="input text-sm" /></div>
                            <div><label className="label-xs">CBU / Alias (Sueldo)</label><input name="aliasCbu" value={formData.aliasCbu} onChange={handleChange} className="input text-sm" /></div>
                        </div>
                    )}

                    {msg && <div className="p-2 text-xs text-center rounded bg-red-100 text-red-700">{msg}</div>}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn btn-outline text-sm">Cancelar</button>
                        <button type="submit" disabled={loading} className="btn btn-primary w-32 text-sm">
                            {loading ? "..." : isCreating ? "Crear" : "Guardar"}
                        </button>
                    </div>
                </form>
            </div>
            <style jsx>{`
                .label-xs { @apply block text-xs font-bold text-muted uppercase mb-1; }
            `}</style>
        </div>
    );
}