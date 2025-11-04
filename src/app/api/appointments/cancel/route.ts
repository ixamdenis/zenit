export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, AppointmentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const HOURS_WINDOW = 12;

type CancelBody = {
    appointmentId: string;
    whoUserId?: string;
    reason?: string;
    isAdmin?: boolean;
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as CancelBody;

        // Validar body
        if (!body.appointmentId || typeof body.appointmentId !== "string" || body.appointmentId.trim() === "") {
            return NextResponse.json({ error: "Falta 'appointmentId' en el body" }, { status: 400 });
        }

        // Buscar turno + servicio
        const appt = await prisma.appointment.findUnique({
            where: { id: body.appointmentId },
            include: { service: true }
        });

        if (!appt) return NextResponse.json({ error: "Turno no existe" }, { status: 404 });
        if (appt.estado === "CANCELADO") {
            return NextResponse.json({ error: "El turno ya está cancelado" }, { status: 400 });
        }

        // Ventana de penalidad
        const now = new Date();
        const hoursDiff = (appt.fecha.getTime() - now.getTime()) / 36e5;
        const insideWindow = hoursDiff <= HOURS_WINDOW;

        const percent = appt.service.penalidadPorcentaje ?? 0.5; // 50% por defecto
        const amount = insideWindow ? Math.round(appt.service.precioBase * percent) : 0;
        const penalidadMonto = body.isAdmin ? 0 : amount;

        // Transacción (array) => sin uso de tx.cancellation para evitar warnings de tipos antiguos
        const [updated] = await prisma.$transaction([
            prisma.appointment.update({
                where: { id: body.appointmentId },
                data: { estado: AppointmentStatus.CANCELADO }
            }),
            prisma.cancellation.create({
                data: {
                    appointmentId: body.appointmentId,
                    who: body.whoUserId ?? "system",
                    reason: body.reason,
                    penalidadCobrada: false,
                    penalidadMonto
                }
            })
        ]);

        return NextResponse.json({
            canceled: true,
            appointment: updated,
            penalty: { insideWindow, penalidadMonto }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
