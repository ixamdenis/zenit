export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// (Mantener las funciones auxiliares e imports existentes)...

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // --- NUEVA LÓGICA DE RANGOS ---
        const from = searchParams.get("from"); // ISO string start
        const to = searchParams.get("to");     // ISO string end
        const dateStr = searchParams.get("date"); // Fallback legacy

        const professionalEmail = searchParams.get("professionalEmail");
        const professionalId = searchParams.get("professionalId");
        const includeCancelledRaw = (searchParams.get("includeCancelled") || "").toLowerCase();
        const includeCancelled = ["1", "true", "yes", "si", "sí"].includes(includeCancelledRaw);

        // Construir el filtro de fecha
        let dateFilter: any = {};

        if (from && to) {
            // Si el calendario pide un rango específico
            dateFilter = {
                gte: new Date(from),
                lte: new Date(to)
            };
        } else if (dateStr) {
            // Lógica anterior para un solo día (fallback)
            const [y, m, d] = dateStr.split("-").map(Number);
            const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
            const end = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));
            dateFilter = { gte: start, lte: end };
        } else {
            // Default: Hoy
            const now = new Date();
            const start = new Date(now.setHours(0, 0, 0, 0));
            const end = new Date(now.setHours(23, 59, 59, 999));
            dateFilter = { gte: start, lte: end };
        }

        // Resolver ID profesional (Misma lógica anterior)
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

        // Query Principal
        const where: any = { fecha: dateFilter };
        if (profId) where.professionalId = profId;
        if (!includeCancelled) where.estado = { not: "CANCELADO" };

        const appts = await prisma.appointment.findMany({
            where,
            orderBy: { fecha: "asc" },
            include: {
                patient: { include: { user: true } },
                professional: { include: { user: true } },
                professionalService: true,
                room: true,
                payments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        // Mapping de respuesta (Igual que antes)
        // ... (El resto del código del mapeo se mantiene igual)

        return NextResponse.json({
            range: { from, to },
            count: appts.length,
            appointments: appts.map((a: any) => { // Usa tu tipo ApptWithRelations aquí
                const payment = a.payments[0];
                return {
                    id: a.id,
                    estado: a.estado,
                    startAt: a.fecha,
                    endAt: a.horaFin,
                    serviceId: a.professionalServiceId,
                    serviceName: a.professionalService.nombre,
                    roomId: a.roomId ?? null,
                    roomName: a.room?.nombre ?? null,
                    patientId: a.patientId,
                    professionalId: a.professionalId,
                    patientName: [a.patient?.nombre, a.patient?.apellido].filter(Boolean).join(" ").trim() || a.patient?.user?.email || "Sin nombre",
                    professionalName: [a.professional?.nombre, a.professional?.apellido].filter(Boolean).join(" ").trim() || "",
                    paymentId: payment?.id ?? null,
                    paymentStatus: payment?.status ?? null,
                };
            })
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}