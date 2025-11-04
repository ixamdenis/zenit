export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}

type Body = {
    appointmentId: string;
    newStartISO: string; // nueva fecha/hora (puede ser otro día)
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Body;
        const { appointmentId, newStartISO } = body || {};
        if (!appointmentId || !newStartISO) {
            return NextResponse.json({ error: "Campos requeridos: appointmentId y newStartISO" }, { status: 400 });
        }

        const appt = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { service: true, professional: true }
        });
        if (!appt) return NextResponse.json({ error: "Turno no existe" }, { status: 404 });

        const startAt = new Date(newStartISO);
        if (isNaN(startAt.getTime())) {
            return NextResponse.json({ error: "newStartISO inválido" }, { status: 400 });
        }
        const dur = appt.service.duracionMin;
        const endAt = addMinutes(startAt, dur);

        // Validar disponibilidad del NUEVO día
        const dayOfWeek = startAt.getDay();
        const avail = await prisma.availability.findMany({
            where: { professionalId: appt.professionalId, dayOfWeek }
        });

        const withinAvailability = avail.some(a => {
            const [sh, sm] = a.startTime.split(":").map(Number);
            const [eh, em] = a.endTime.split(":").map(Number);
            const base = new Date(startAt);
            base.setHours(0, 0, 0, 0);
            const aStart = new Date(base); aStart.setHours(sh, sm, 0, 0);
            const aEnd = new Date(base); aEnd.setHours(eh, em, 0, 0);
            return startAt >= aStart && endAt <= aEnd;
        });
        if (!withinAvailability) {
            return NextResponse.json({ error: "Horario fuera de disponibilidad del profesional" }, { status: 400 });
        }

        // No solapar con otros turnos (ignorando el mismo)
        const overlap = await prisma.appointment.findFirst({
            where: {
                professionalId: appt.professionalId,
                id: { not: appt.id },
                estado: { in: ["RESERVADO", "CONFIRMADO"] },
                OR: [{ AND: [{ fecha: { lt: endAt } }, { horaFin: { gt: startAt } }] }]
            }
        });
        if (overlap) {
            return NextResponse.json({ error: "El horario ya está ocupado" }, { status: 409 });
        }

        // ----- Reglas de cobro -----
        // Si faltan >=24h para el turno original => penalidad = 0
        const now = new Date();
        const hoursToOriginal = (appt.fecha.getTime() - now.getTime()) / 36e5;
        const penalidad = hoursToOriginal >= 24
            ? 0
            : Math.round(appt.service.precioBase * (appt.service.penalidadPorcentaje ?? 0.5));
        const amountService = appt.service.precioBase;
        const amountTotal = amountService + penalidad;

        // Actualizar turno + generar "Payment" PENDING
        // Nota: si VSCode sigue sin reconocer prisma.payment, corré:
        //   npx prisma generate  (y reiniciá el TS Server)
        // Para que no te frene el tipado, usamos bracket-notation:
        //   (prisma as any)["payment"].create(...)
        const [updated, payment] = await prisma.$transaction([
            prisma.appointment.update({
                where: { id: appt.id },
                data: { fecha: startAt, horaFin: endAt }
            }),
            (prisma as any)["payment"].create({
                data: {
                    appointmentId: appt.id,
                    amountService,
                    amountPenalty: penalidad,
                    amountTotal,
                    status: "PENDING",
                    note: penalidad > 0 ? "Reprogramación <24h" : "Reprogramación sin penalidad (≥24h)"
                }
            })
        ]);

        return NextResponse.json({
            appointment: updated,
            charge: {
                amountService,
                amountPenalty: penalidad,
                amountTotal,
                status: payment.status
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Error reprogramando turno" }, { status: 500 });
    }
}
