export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
    PrismaClient,
    Appointment,
    PatientProfile,
    ProfessionalProfile,
    ProfessionalService, // <-- CAMBIO
    Room,
    Payment,
    User
} from "@prisma/client";

const prisma = new PrismaClient();

function ymdToUtcRange(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));
    return { start, end };
}

type ApptWithRelations = Appointment & {
    patient: (PatientProfile & { user: User | null }) | null;
    professional: (ProfessionalProfile & { user: User | null }) | null;
    professionalService: ProfessionalService; // <-- CAMBIO
    room: Room | null;
    payments: Payment[];
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get("date");
        const professionalEmail = searchParams.get("professionalEmail");
        const professionalId = searchParams.get("professionalId");
        const includeCancelledRaw = (searchParams.get("includeCancelled") || "").toLowerCase();
        const includeCancelled = ["1", "true", "yes", "si", "sí"].includes(includeCancelledRaw);

        if (!dateStr) {
            return NextResponse.json({ error: "Parámetro requerido: date" }, { status: 400 });
        }

        const { start, end } = ymdToUtcRange(dateStr);

        let profId: string | undefined = undefined;
        if (professionalId) {
            profId = professionalId;
        } else if (professionalEmail) {
            const u = await prisma.user.findUnique({ where: { email: professionalEmail } });
            if (u) {
                const p = await prisma.professionalProfile.findUnique({ where: { userId: u.id } });
                profId = p?.id;
            }
        }

        const where: any = { fecha: { gte: start, lte: end } };
        if (profId) where.professionalId = profId;
        if (!includeCancelled) where.estado = { not: "CANCELADO" };

        const appts = await prisma.appointment.findMany({
            where,
            orderBy: { fecha: "asc" },
            include: {
                patient: { include: { user: true } },
                professional: { include: { user: true } },
                professionalService: true, // <-- CAMBIO: Usamos la nueva relación
                room: true,
                payments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        return NextResponse.json({
            date: dateStr,
            count: appts.length,
            appointments: appts.map((a: ApptWithRelations) => {
                const payment = a.payments[0];
                return {
                    id: a.id,
                    estado: a.estado,
                    startAt: a.fecha,
                    endAt: a.horaFin,
                    serviceId: a.professionalServiceId, // <-- CAMBIO
                    serviceName: a.professionalService.nombre, // <-- CAMBIO
                    roomId: a.roomId ?? null,
                    roomName: a.room?.nombre ?? null,
                    patientId: a.patientId,
                    professionalId: a.professionalId,
                    patientName: [a.patient?.nombre, a.patient?.apellido].filter(Boolean).join(" ").trim() || a.patient?.user?.email || "",
                    professionalName: [a.professional?.nombre, a.professional?.apellido].filter(Boolean).join(" ").trim() || a.professional?.user?.email || "",
                    paymentId: payment?.id ?? null,
                    paymentStatus: payment?.status ?? null,
                };
            })
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}