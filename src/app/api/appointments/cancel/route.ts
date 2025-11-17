export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, AppointmentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const HOURS_WINDOW = 24; // <-- CAMBIO: Ahora son 24hs

type CancelBody = {
    appointmentId: string;
    whoUserId?: string;
    reason?: string;
    isAdmin?: boolean;
    cbuReintegro?: string; // <-- CAMBIO: Nuevo campo opcional
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as CancelBody;
        if (!body.appointmentId) return NextResponse.json({ error: "Falta 'appointmentId'" }, { status: 400 });

        const appt = await prisma.appointment.findUnique({
            where: { id: body.appointmentId },
            include: { professionalService: true }
        });

        if (!appt) return NextResponse.json({ error: "Turno no existe" }, { status: 404 });
        if (appt.estado === "CANCELADO") return NextResponse.json({ error: "El turno ya está cancelado" }, { status: 400 });

        const now = new Date();
        const hoursDiff = (appt.fecha.getTime() - now.getTime()) / 36e5;

        // Si hoursDiff < 24, estamos DENTRO de la ventana de penalidad (menos de 24hs)
        const insideWindow = hoursDiff <= HOURS_WINDOW;

        // Cálculo de penalidad
        // Si es admin, 0.
        // Si está DENTRO de las 24hs (cancela tarde), se cobra el % definido (ej 50% o 100% de la seña).
        // Si está FUERA de las 24hs (cancela con tiempo), es 0.
        const percent = appt.professionalService.penalidadPorcentaje ?? 0.5;
        const amount = insideWindow ? Math.round(appt.professionalService.precioBase * percent) : 0;

        const penalidadMonto = body.isAdmin ? 0 : amount;

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
                    penalidadMonto,
                    cbuReintegro: body.cbuReintegro // <-- Guardamos el CBU si vino
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