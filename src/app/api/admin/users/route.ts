export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

// Middleware de seguridad manual para la API
async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== Role.ADMIN) {
        throw new Error("Acceso denegado: Se requieren permisos de Super Admin.");
    }
    return session;
}

// GET: Listar todos los usuarios con sus perfiles
export async function GET() {
    try {
        await checkAdmin();

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                patient: true,
                prof: true
            }
        });

        // Mapeamos para enviar data segura al front
        const data = users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            nombre: u.patient?.nombre || u.prof?.nombre || "Admin",
            apellido: u.patient?.apellido || u.prof?.apellido || "System",
            details: u.patient ? `Paciente (DNI: ${u.patient.dni})` : u.prof ? `Profesional (${u.prof.especialidad})` : "Administrador"
        }));

        return NextResponse.json({ users: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 403 });
    }
}

// DELETE: Borrar un usuario y TODA su data asociada (Cascada manual si es necesario)
export async function DELETE(req: NextRequest) {
    try {
        const session = await checkAdmin();
        const { searchParams } = new URL(req.url);
        const idToDelete = searchParams.get("id");

        if (!idToDelete) return NextResponse.json({ error: "Falta ID" }, { status: 400 });
        if (idToDelete === session.userId) return NextResponse.json({ error: "No puedes auto-eliminarte." }, { status: 400 });

        // Prisma maneja el onDelete: Cascade si está configurado en el schema, 
        // pero por seguridad vamos a limpiar relaciones explícitas críticas primero.

        // 1. Si es profesional, limpiamos sus citas, pagos y disponibilidad
        const profProfile = await prisma.professionalProfile.findUnique({ where: { userId: idToDelete } });
        if (profProfile) {
            // Borrar servicios
            await prisma.professionalService.deleteMany({ where: { professionalId: profProfile.id } });
            // Borrar disponibilidad
            await prisma.availability.deleteMany({ where: { professionalId: profProfile.id } });
            // Los turnos (appointments) se borrarán o quedarán huérfanos según schema. 
            // Lo ideal es borrar turnos futuros.
            await prisma.appointment.deleteMany({ where: { professionalId: profProfile.id } });
        }

        // 2. Si es paciente, borramos sus turnos
        const patProfile = await prisma.patientProfile.findUnique({ where: { userId: idToDelete } });
        if (patProfile) {
            await prisma.appointment.deleteMany({ where: { patientId: patProfile.id } });
        }

        // 3. Finalmente borramos el User (esto debería borrar perfiles por cascada en schema)
        // Si el schema no tiene onDelete: Cascade, esto fallará, así que aseguramos borrar perfiles antes.
        if (profProfile) await prisma.professionalProfile.delete({ where: { id: profProfile.id } });
        if (patProfile) await prisma.patientProfile.delete({ where: { id: patProfile.id } });

        await prisma.user.delete({ where: { id: idToDelete } });

        return NextResponse.json({ ok: true, message: "Usuario eliminado y datos purgados." });

    } catch (e: any) {
        console.error("Delete error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}