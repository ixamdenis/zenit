"use client";

import { useEffect, useState } from "react";

// --- Tipos de Datos ---
type Availability = {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName: string;
    roomId: string | null;
};
type Service = {
    id: string; // Cambiado de serviceId a id para consistencia
    nombre: string;
    duracionMin: number;
    precioBase: number;
};
type Room = { id: string; nombre: string };
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// --- Helpers ---
async function safeJson<T = any>(r: Response): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
    const status = r.status;
    let txt = ""; try { txt = await r.text(); } catch (e: any) { return { ok: r.ok, data: null, error: e?.message ?? "No se pudo leer la respuesta", status }; }
    if (!txt) return { ok: r.ok, data: null, error: r.ok ? null : `Error HTTP ${status}`, status };
    try { const json = JSON.parse(txt); return { ok: r.ok, data: json, error: r.ok ? null : (json as any)?.error ?? `Error HTTP ${status}`, status }; }
    catch { return { ok: r.ok, data: null, error: r.ok ? null : txt, status }; }
}

export default function ProfesionalPerfilPage() {

    const [aliasBancario, setAliasBancario] = useState("");
    const [availability, setAvailability] = useState<Availability[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [newAvail, setNewAvail] = useState({ dayOfWeek: 1, startTime: "09:00", endTime: "13:00", roomId: "" });
    const [newService, setNewService] = useState({ nombre: "", duracionMin: 30, precioBase: 10000 });

    const loadData = async () => {
        setLoading(true);
        setMsg("");
        try {
            // Ahora TODO viene de esta única llamada
            const r = await fetch("/api/profesional/perfil");
            const { data, error } = await safeJson(r);
            if (error) throw new Error(error);

            setAliasBancario(data.profile.aliasBancario ?? "");
            setAvailability(data.availability ?? []);
            setServices(data.services ?? []); // Servicios propios
            setRooms(data.rooms ?? []);
            setNewAvail(prev => ({
                ...prev,
                roomId: prev.roomId || data.rooms?.[0]?.id || ""
            }));

        } catch (e: any) {
            setMsg(e.message);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData().catch(() => { });
    }, []);

    // --- Acciones ---

    const handleSaveAlias = async () => {
        setMsg("");
        const r = await fetch("/api/profesional/perfil", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aliasBancario: aliasBancario }),
        });
        const { ok, error } = await safeJson(r);
        if (!ok) setMsg(error ?? "Error al guardar alias");
        else setMsg("Alias actualizado.");
    };

    const handleAddAvailability = () => {
        const room = rooms.find(r => r.id === newAvail.roomId);
        if (!room) {
            setMsg("Debes seleccionar un consultorio.");
            return;
        }
        setAvailability([
            ...availability,
            { ...newAvail, id: `temp-${Date.now()}`, roomName: room.nombre }
        ]);
    };

    const handleRemoveAvailability = (id: string) => {
        setAvailability(availability.filter(a => a.id !== id));
    };

    const handleSaveAvailability = async () => {
        setMsg("");
        const r = await fetch("/api/profesional/perfil", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                availability: availability.map(a => ({
                    dayOfWeek: a.dayOfWeek,
                    startTime: a.startTime,
                    endTime: a.endTime,
                    roomId: a.roomId ?? undefined,
                }))
            }),
        });
        const { ok, error } = await safeJson(r);
        if (!ok) setMsg(error ?? "Error al guardar horarios");
        else setMsg("Horarios actualizados.");
        await loadData();
    };

    const handleAddService = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg("");
        const r = await fetch("/api/services", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newService),
        });
        const { ok, error } = await safeJson(r);
        if (!ok) setMsg(error ?? "Error al crear servicio");
        else setMsg("Servicio creado.");
        setNewService({ nombre: "", duracionMin: 30, precioBase: 10000 });
        await loadData();
    };

    const handleDeleteService = async (id: string) => {
        if (!window.confirm("¿Seguro que quieres borrar este servicio?")) return;
        setMsg("");
        const r = await fetch(`/api/services?id=${id}`, { method: "DELETE" });
        const { ok, error } = await safeJson(r);
        if (!ok) setMsg(error ?? "Error al borrar servicio");
        else setMsg("Servicio eliminado.");
        await loadData();
    };


    if (loading) return <div className="p-8 text-center">Cargando perfil...</div>;

    return (
        <div className="space-y-6">
            <h1 className="h1">Mi Perfil</h1>

            {msg && <div className="card bg-brand-warn/20 border-brand p-4 text-sm">{msg}</div>}

            {/* 1. ALIAS */}
            <section className="card">
                <h2 className="h2">Alias Bancario</h2>
                <p className="text-sm text-muted mt-1">Este alias verán los pacientes para enviarte los pagos.</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                        <input
                            type="text"
                            value={aliasBancario}
                            onChange={(e) => setAliasBancario(e.target.value)}
                            className="input mt-1"
                            placeholder="mi.alias.mp"
                        />
                    </div>
                    <button onClick={handleSaveAlias} className="btn btn-primary">Guardar Alias</button>
                </div>
            </section>

            {/* 2. HORARIOS */}
            <section className="card">
                <h2 className="h2">Horarios de Atención</h2>
                <div className="mt-4 space-y-2">
                    {availability.length === 0 ? (
                        <p className="text-sm text-muted">No tienes horarios cargados.</p>
                    ) : (
                        availability.map((a) => (
                            <div key={a.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 p-2 bg-gray-50 rounded-lg">
                                <div className="font-medium">{DIAS_SEMANA[a.dayOfWeek]}</div>
                                <div className="text-sm text-muted">{a.roomName}</div>
                                <div>{a.startTime} a {a.endTime}</div>
                                <button onClick={() => handleRemoveAvailability(a.id)} className="text-red-600 text-sm">Quitar</button>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="block text-sm font-medium">Día</label>
                        <select
                            className="input mt-1"
                            value={newAvail.dayOfWeek}
                            onChange={e => setNewAvail(p => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                        >
                            <option value={1}>Lunes</option>
                            <option value={2}>Martes</option>
                            <option value={3}>Miércoles</option>
                            <option value={4}>Jueves</option>
                            <option value={5}>Viernes</option>
                            <option value={6}>Sábado</option>
                            <option value={0}>Domingo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Consultorio</label>
                        <select
                            className="input mt-1"
                            value={newAvail.roomId}
                            onChange={e => setNewAvail(p => ({ ...p, roomId: e.target.value }))}
                        >
                            {rooms.length === 0 ? <option value="">Sin consultorios</option> : null}
                            {rooms.map(r => (
                                <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Desde</label>
                        <input type="time" value={newAvail.startTime} onChange={e => setNewAvail(p => ({ ...p, startTime: e.target.value }))} className="input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Hasta</label>
                        <input type="time" value={newAvail.endTime} onChange={e => setNewAvail(p => ({ ...p, endTime: e.target.value }))} className="input mt-1" />
                    </div>
                    <button onClick={handleAddAvailability} className="btn btn-outline">+ Agregar</button>
                </div>
                <button onClick={handleSaveAvailability} className="btn btn-primary w-full mt-4">Guardar Horarios</button>
            </section>

            {/* 3. SERVICIOS PROPIOS */}
            <section className="card">
                <h2 className="h2">Mis Servicios</h2>
                <p className="text-sm text-muted mt-1">Servicios que ofreces exclusivamente.</p>

                <div className="mt-4 space-y-2">
                    {services.length === 0 ? <p className="text-sm text-muted">No has creado servicios.</p> : null}
                    {services.map((s) => (
                        <div key={s.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                            <div>
                                <span className="font-medium">{s.nombre}</span>
                                <span className="text-sm text-muted"> ({s.duracionMin} min)</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-semibold">${s.precioBase}</span>
                                <button onClick={() => handleDeleteService(s.id)} className="text-red-600 text-sm">Borrar</button>
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleAddService} className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                        <label className="block text-sm font-medium">Nombre</label>
                        <input type="text" value={newService.nombre} onChange={e => setNewService(p => ({ ...p, nombre: e.target.value }))} className="input mt-1" placeholder="Ej: Consulta" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Minutos</label>
                        <input type="number" value={newService.duracionMin} onChange={e => setNewService(p => ({ ...p, duracionMin: Number(e.target.value) }))} className="input mt-1" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Precio $</label>
                        <input type="number" value={newService.precioBase} onChange={e => setNewService(p => ({ ...p, precioBase: Number(e.target.value) }))} className="input mt-1" required />
                    </div>
                    <button type="submit" className="btn btn-outline">+ Crear</button>
                </form>
            </section>
        </div>
    );
}