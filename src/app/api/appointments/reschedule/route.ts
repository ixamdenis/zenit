export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, AppointmentStatus, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();
const HOURS_WINDOW = 24; // <-- Regla de negocio

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}

type Body = { appointmentId: string; newStartISO: string; };
type AvailabilityItem = { startTime: string; endTime: string; };

export async function POST(req: NextRequest) {
    try {
        const session = await getSession(); // Necesitamos saber quién es
        const body = (await req.json()) as Body;
        const { appointmentId, newStartISO } = body || {};

        if (!appointmentId || !newStartISO) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        const appt = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { professionalService: true, professional: true }
        });
        if (!appt) return NextResponse.json({ error: "Turno no existe" }, { status: 404 });

        // --- INICIO: VALIDACIÓN 24HS PARA PACIENTE ---
        const now = new Date();
        const hoursToOriginal = (appt.fecha.getTime() - now.getTime()) / 36e5;

        if (session?.role === Role.PACIENTE) {
            if (hoursToOriginal < HOURS_WINDOW) {
                return NextResponse.json({
                    error: "Faltan menos de 24hs. No se puede reprogramar, debes cancelar (se retiene la seña) y sacar uno nuevo."
                }, { status: 403 });
            }
        }
        // --- FIN: VALIDACIÓN ---

        const startAt = new Date(newStartISO);
        if (isNaN(startAt.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

        const dur = appt.professionalService.duracionMin;
        const endAt = addMinutes(startAt, dur);
        const dayOfWeek = startAt.getDay();

        // Verificar disponibilidad del profesional
        const avail = await prisma.availability.findMany({
            where: { professionalId: appt.professionalId, dayOfWeek }
        });

        const withinAvailability = avail.some((a: AvailabilityItem) => {
            const [sh, sm] = a.startTime.split(":").map(Number);
            const [eh, em] = a.endTime.split(":").map(Number);
            const base = new Date(startAt);
            base.setHours(0, 0, 0, 0);
            const aStart = new Date(base); aStart.setHours(sh, sm, 0, 0);
            const aEnd = new Date(base); aEnd.setHours(eh, em, 0, 0);
            return startAt >= aStart && endAt <= aEnd;
        });
        if (!withinAvailability) {
            return NextResponse.json({ error: "El profesional no atiende en ese horario" }, { status: 400 });
        }

        // Verificar solapamiento
        const overlap = await prisma.appointment.findFirst({
            where: {
                professionalId: appt.professionalId,
                id: { not: appt.id },
                estado: { in: [AppointmentStatus.RESERVADO, AppointmentStatus.CONFIRMADO] },
                OR: [{ AND: [{ fecha: { lt: endAt } }, { horaFin: { gt: startAt } }] }]
            }
        });
        if (overlap) return NextResponse.json({ error: "El horario ya está ocupado" }, { status: 409 });

        // Reglas de cobro (para Admin/Pro que sí pueden moverlo <24hs, o Paciente >24hs)
        // Si es paciente y pasó la validación anterior, penalidad es 0.
        const penalidad = hoursToOriginal >= 24
            ? 0
            : Math.round(appt.professionalService.precioBase * (appt.professionalService.penalidadPorcentaje ?? 0.5));

        const amountService = appt.professionalService.precioBase;
        const amountTotal = amountService + penalidad;

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
                    status: "PENDING", // Se genera nueva orden de pago si hubo cambio, o se mantiene la lógica de seña
                    note: penalidad > 0 ? "Reprogramación <24h" : "Reprogramación (>24h) - Seña reutilizada"
                }
            })
        ]);

        return NextResponse.json({
            appointment: updated,
            charge: { amountService, amountPenalty: penalidad, amountTotal, status: payment.status }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
    }
}