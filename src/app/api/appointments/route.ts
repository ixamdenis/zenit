export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, AppointmentStatus, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}

type CreateBody = {
    patientEmail?: string;
    professionalEmail: string;
    serviceName: string;
    startAtISO: string;
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as CreateBody;
        let { patientEmail, professionalEmail, serviceName, startAtISO } = body || {};

        const session = await getSession();
        let patientProfileId: string | undefined;

        if (session && session.role === Role.PACIENTE) {
            const p = await prisma.patientProfile.findUnique({ where: { userId: session.userId } });
            if (!p) return NextResponse.json({ error: "Perfil de paciente no encontrado" }, { status: 404 });
            patientProfileId = p.id;
        } else if (patientEmail) {
            const patientUser = await prisma.user.findUnique({ where: { email: patientEmail } });
            if (!patientUser) return NextResponse.json({ error: "Paciente (por email) no existe" }, { status: 404 });
            const p = await prisma.patientProfile.findUnique({ where: { userId: patientUser.id } });
            if (!p) return NextResponse.json({ error: "Perfil de paciente no existe" }, { status: 404 });
            patientProfileId = p.id;
        } else {
            return NextResponse.json({ error: "Se requiere 'patientEmail' o ser un paciente logueado" }, { status: 400 });
        }

        if (!professionalEmail || !serviceName || !startAtISO) {
            return NextResponse.json({ error: "Campos requeridos: professionalEmail, serviceName, startAtISO" }, { status: 400 });
        }

        // Entidades
        const professionalUser = await prisma.user.findUnique({ where: { email: professionalEmail } });
        if (!professionalUser) return NextResponse.json({ error: "Profesional no existe" }, { status: 404 });
        const professional = await prisma.professionalProfile.findUnique({ where: { userId: professionalUser.id } });
        if (!professional) return NextResponse.json({ error: "Profesional no existe" }, { status: 404 });

        // --- CAMBIO: Buscar servicio del profesional específico ---
        const service = await prisma.professionalService.findFirst({
            where: {
                nombre: serviceName,
                professionalId: professional.id // <--- Filtro
            }
        });
        if (!service) return NextResponse.json({ error: "Servicio no existe para este profesional" }, { status: 404 });
        // --- FIN CAMBIO ---

        const startAt = new Date(startAtISO);
        if (isNaN(startAt.getTime())) {
            return NextResponse.json({ error: "startAtISO inválido" }, { status: 400 });
        }
        const endAt = addMinutes(startAt, service.duracionMin);

        const overlap = await prisma.appointment.findFirst({
            where: {
                professionalId: professional.id,
                estado: { in: ["RESERVADO", "CONFIRMADO"] },
                OR: [{ AND: [{ fecha: { lt: endAt } }, { horaFin: { gt: startAt } }] }]
            }
        });
        if (overlap) {
            return NextResponse.json({ error: "El horario ya está ocupado" }, { status: 409 });
        }

        const created = await prisma.$transaction(async (tx) => {
            const appt = await tx.appointment.create({
                data: {
                    patientId: patientProfileId!,
                    professionalId: professional.id,
                    professionalServiceId: service.id, // <-- CAMBIO: Usamos professionalServiceId
                    fecha: startAt,
                    horaFin: endAt,
                    estado: AppointmentStatus.RESERVADO
                },
                include: { professionalService: true } // <-- CAMBIO: include
            });

            await (tx as any)["payment"].create({
                data: {
                    appointmentId: appt.id,
                    amountService: appt.professionalService.precioBase, // <-- CAMBIO: precio del servicio nuevo
                    amountPenalty: 0,
                    amountTotal: appt.professionalService.precioBase,
                    status: "PENDING",
                    note: "Nuevo turno"
                }
            });

            return appt;
        });

        return NextResponse.json({ appointment: created });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}