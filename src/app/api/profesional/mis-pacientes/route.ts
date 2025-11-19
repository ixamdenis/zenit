export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== Role.PROFESIONAL) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const professionalProfile = await prisma.professionalProfile.findUnique({
            where: { userId: session.userId },
            select: { id: true }
        });

        if (!professionalProfile) {
            return NextResponse.json({ error: "Perfil profesional no encontrado" }, { status: 404 });
        }

        // 1. Encontrar todos los IDs de pacientes únicos que el profesional ha atendido
        const appointments = await prisma.appointment.findMany({
            where: {
                professionalId: professionalProfile.id,
            },
            select: { patientId: true },
            distinct: ['patientId']
        });

        const patientIds = appointments.map(a => a.patientId);

        // 2. Buscar los perfiles completos de esos pacientes
        const patients = await prisma.patientProfile.findMany({
            where: {
                id: { in: patientIds }
            },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                dni: true,
                user: {
                    select: { email: true }
                }
            },
            orderBy: [{ apellido: "asc" }, { nombre: "asc" }]
        });

        const data = patients.map(p => ({
            id: p.id,
            nombre: p.nombre,
            apellido: p.apellido,
            dni: p.dni,
            email: p.user.email,
            nombreCompleto: `${p.nombre} ${p.apellido}`
        }));

        return NextResponse.json({ patients: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Error al listar pacientes" }, { status: 500 });
    }
}