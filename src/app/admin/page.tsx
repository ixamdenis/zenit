"use client";

import { useEffect, useState } from "react";
import DangerousConfirmModal from "@/components/DangerousConfirmModal";

type UserItem = {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    nombre: string;
    apellido: string;
    details: string;
};

export default function AdminDashboardPage() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    // Estado para el modal de borrado
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/admin/users");
            const data = await r.json();
            if (r.ok) {
                setUsers(data.users);
            } else {
                setMsg(data.error || "Error cargando usuarios");
            }
        } catch (e) {
            setMsg("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleDeleteRequest = (u: UserItem) => {
        setUserToDelete(u);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setDeleteModalOpen(false);
        setMsg(""); // Limpiar mensajes

        try {
            const r = await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: "DELETE" });
            const data = await r.json();
            if (r.ok) {
                setMsg(`Usuario ${userToDelete.email} eliminado correctamente.`);
                loadUsers(); // Recargar lista
            } else {
                setMsg(`Error: ${data.error}`);
            }
        } catch (e) {
            setMsg("Error al intentar eliminar.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="h1 text-red-900">Panel de Super Admin</h1>
                    <p className="text-muted">Gestión total del sistema. Ten cuidado.</p>
                </div>
                <button onClick={loadUsers} className="btn btn-outline text-sm">Actualizar Lista</button>
            </div>

            {msg && <div className="p-4 rounded-lg bg-gray-100 border border-gray-300 text-sm font-medium">{msg}</div>}

            <section className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                            <tr>
                                <th className="p-3">Rol</th>
                                <th className="p-3">Usuario / Email</th>
                                <th className="p-3">Detalle</th>
                                <th className="p-3">Registro</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-4 text-center text-muted">Cargando base de datos...</td></tr>
                            ) : users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition">
                                    <td className="p-3">
                                        <span className={`badge ${u.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                                                u.role === 'PROFESIONAL' ? 'bg-blue-100 text-blue-800' :
                                                    u.role === 'RECEPCION' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'
                                            }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <div className="font-medium">{u.apellido}, {u.nombre}</div>
                                        <div className="text-xs text-muted">{u.email}</div>
                                    </td>
                                    <td className="p-3 text-gray-600">{u.details}</td>
                                    <td className="p-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => handleDeleteRequest(u)}
                                            className="btn bg-white border-red-200 text-red-600 hover:bg-red-50 text-xs py-1 px-3"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Modal de Seguridad */}
            <DangerousConfirmModal
                isOpen={deleteModalOpen}
                title={`¿Eliminar a ${userToDelete?.nombre} ${userToDelete?.apellido}?`}
                description={`Estás a punto de borrar al usuario ${userToDelete?.email} y TODOS sus datos asociados (Turnos, Historial, Pagos, Perfiles). Esta acción es irreversible y podría afectar la integridad de datos históricos.`}
                confirmKeyword="ELIMINAR"
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}