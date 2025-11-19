// src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import DangerousConfirmModal from "@/components/DangerousConfirmModal";
import AdminEditUserModal from "@/components/AdminEditUserModal";

type UserItem = {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    nombreDisplay: string;
    apellidoDisplay: string;
    detailsDisplay: string;
    patient?: any;
    prof?: any;
    recep?: any; // <-- Agregado
};

export default function AdminDashboardPage() {
    // ... (Estados existentes: users, loading, msg, deleteModalOpen...)
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

    // Modal Edición / Creación
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<UserItem | null>(null); // null = Crear nuevo

    const loadUsers = async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/admin/users");
            const data = await r.json();
            if (r.ok) setUsers(data.users);
            else setMsg(data.error || "Error cargando usuarios");
        } catch (e) { setMsg("Error de conexión"); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadUsers(); }, []);

    // Handlers
    const handleDeleteRequest = (u: UserItem) => { setUserToDelete(u); setDeleteModalOpen(true); };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setDeleteModalOpen(false);
        setMsg("");
        try {
            const r = await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: "DELETE" });
            if (r.ok) { setMsg("Eliminado."); loadUsers(); }
            else { const d = await r.json(); setMsg(d.error); }
        } catch (e) { setMsg("Error al eliminar."); }
    };

    const handleEditRequest = (u: UserItem) => {
        setUserToEdit(u);
        setEditModalOpen(true);
    };

    const handleCreateRequest = () => {
        setUserToEdit(null); // null indica MODO CREACIÓN
        setEditModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                <div>
                    <h1 className="h1 text-red-900">Panel de Super Admin</h1>
                    <p className="text-muted">Gestión de usuarios y empleados.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadUsers} className="btn btn-outline text-sm">↻ Actualizar</button>
                    <button onClick={handleCreateRequest} className="btn btn-primary text-sm shadow-md">
                        + Nuevo Usuario
                    </button>
                </div>
            </div>

            {msg && <div className="p-3 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-sm text-center">{msg}</div>}

            <section className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                            <tr>
                                <th className="p-3">Rol</th>
                                <th className="p-3">Nombre / Email</th>
                                <th className="p-3">Detalle</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-muted">Cargando...</td></tr>
                            ) : users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition">
                                    <td className="p-3">
                                        <span className={`badge ${u.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                                                u.role === 'PROFESIONAL' ? 'bg-blue-100 text-blue-800' :
                                                    u.role === 'RECEPCION' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <div className="font-medium text-gray-900">{u.apellidoDisplay}, {u.nombreDisplay}</div>
                                        <div className="text-xs text-muted">{u.email}</div>
                                    </td>
                                    <td className="p-3 text-gray-600 text-xs md:text-sm">{u.detailsDisplay}</td>
                                    <td className="p-3 text-right space-x-2">
                                        <button onClick={() => handleEditRequest(u)} className="text-blue-600 hover:underline font-medium">Editar</button>
                                        <button onClick={() => handleDeleteRequest(u)} className="text-red-600 hover:underline">Borrar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Modal Edición / Creación */}
            <AdminEditUserModal
                isOpen={editModalOpen}
                user={userToEdit}
                onClose={() => setEditModalOpen(false)}
                onSuccess={() => {
                    setMsg(userToEdit ? "Usuario actualizado." : "Usuario creado exitosamente.");
                    loadUsers();
                }}
            />

            {/* Modal Borrado */}
            <DangerousConfirmModal
                isOpen={deleteModalOpen}
                title={`¿Eliminar a ${userToDelete?.nombreDisplay}?`}
                description="Esta acción borrará todos los datos (turnos, historial, perfil) asociados."
                confirmKeyword="ELIMINAR"
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}