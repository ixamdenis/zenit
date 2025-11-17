export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

export async function GET() {
    try {
        // 1. Obtener la sesión del usuario
        const session = await getSession();
        if (!session || session.role !== Role.PACIENTE) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // 2. Buscar el perfil de paciente
        const patientProfile = await prisma.patientProfile.findUnique({
            where: { userId: session.userId },
        });

        if (!patientProfile) {
            return NextResponse.json({ error: "Perfil de paciente no encontrado" }, { status: 404 });
        }

        // 3. Buscar turnos del paciente
        const now = new Date();
        const appts = await prisma.appointment.findMany({
            where: {
                patientId: patientProfile.id,
                estado: { not: "CANCELADO" },
                fecha: { gte: now },
            },
            orderBy: { fecha: "asc" },
            include: {
                professional: { include: { user: true } },
                professionalService: true,
                room: true,
                payments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        // 4. Mapear la respuesta
        const data = appts.map(a => ({
            id: a.id,
            estado: a.estado,
            startAt: a.fecha,
            endAt: a.horaFin,
            serviceName: a.professionalService.nombre,
            roomName: a.room?.nombre ?? null,
            // --- INICIO: CAMBIO ---
            professionalId: a.professionalId, // <-- DATO AGREGADO
            // --- FIN: CAMBIO ---
            professionalName: [a.professional?.nombre, a.professional?.apellido].filter(Boolean).join(" ").trim() || a.professional?.user?.email || "",
            paymentId: a.payments[0]?.id ?? null,
            paymentStatus: a.payments[0]?.status ?? null,
        }));

        return NextResponse.json({ appointments: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}