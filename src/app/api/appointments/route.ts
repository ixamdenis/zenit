export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, AppointmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}

type CreateBody = {
    patientEmail: string;
    professionalEmail: string;
    serviceName: string;
    startAtISO: string; // ISO del inicio (puede venir con "Z")
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as CreateBody;
        const { patientEmail, professionalEmail, serviceName, startAtISO } = body || {};
        if (!patientEmail || !professionalEmail || !serviceName || !startAtISO) {
            return NextResponse.json({ error: "Campos requeridos: patientEmail, professionalEmail, serviceName, startAtISO" }, { status: 400 });
        }

        // Entidades
        const patientUser = await prisma.user.findUnique({ where: { email: patientEmail } });
        if (!patientUser) return NextResponse.json({ error: "Paciente no existe" }, { status: 404 });
        const patient = await prisma.patientProfile.findUnique({ where: { userId: patientUser.id } });
        if (!patient) return NextResponse.json({ error: "Paciente no existe" }, { status: 404 });

        const professionalUser = await prisma.user.findUnique({ where: { email: professionalEmail } });
        if (!professionalUser) return NextResponse.json({ error: "Profesional no existe" }, { status: 404 });
        const professional = await prisma.professionalProfile.findUnique({ where: { userId: professionalUser.id } });
        if (!professional) return NextResponse.json({ error: "Profesional no existe" }, { status: 404 });

        const service = await prisma.service.findFirst({ where: { nombre: serviceName } });
        if (!service) return NextResponse.json({ error: "Servicio no existe" }, { status: 404 });

        // Horarios
        const startAt = new Date(startAtISO); // admite ISO con o sin 'Z'
        if (isNaN(startAt.getTime())) {
            return NextResponse.json({ error: "startAtISO inválido" }, { status: 400 });
        }
        const endAt = addMinutes(startAt, service.duracionMin);

        // Evitar solapes
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

        // Crear turno + crear Payment PENDING
        const created = await prisma.$transaction(async (tx) => {
            const appt = await tx.appointment.create({
                data: {
                    patientId: patient.id,
                    professionalId: professional.id,
                    serviceId: service.id,
                    fecha: startAt,
                    horaFin: endAt,
                    estado: AppointmentStatus.RESERVADO
                },
                include: { service: true }
            });

            await (tx as any)["payment"].create({
                data: {
                    appointmentId: appt.id,
                    amountService: appt.service.precioBase,
                    amountPenalty: 0,
                    amountTotal: appt.service.precioBase,
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
