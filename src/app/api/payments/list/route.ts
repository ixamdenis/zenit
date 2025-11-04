export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Convierte "YYYY-MM-DD" a rango [UTC 00:00, UTC 23:59:59.999]
function ymdToUtcRange(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));
    return { start, end };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date"); // YYYY-MM-DD (opcional)
        const status = (searchParams.get("status") || "PENDING").toUpperCase(); // PENDING | PAID | ALL

        // Filtro principal
        const where: any = {};
        if (status !== "ALL") where.status = status;

        if (date) {
            const { start, end } = ymdToUtcRange(date);
            // Filtramos por FECHA DEL TURNO (appointment.fecha), no por createdAt del pago
            where.appointment = { fecha: { gte: start, lte: end } };
        }

        const rows = await (prisma as any)["payment"].findMany({
            where,
            // Ordenamos por fecha del turno (y fallback por createdAt por estabilidad)
            orderBy: [
                { appointment: { fecha: "desc" } },
                { createdAt: "desc" },
            ],
            include: {
                appointment: {
                    include: {
                        service: true,
                        patient: { include: { user: true } },
                        professional: { include: { user: true } },
                    },
                },
            },
        });

        const data = rows.map((p: any) => ({
            id: p.id,
            status: p.status,
            createdAt: p.createdAt, // conservamos por si hace falta auditar
            amountService: p.amountService,
            amountPenalty: p.amountPenalty,
            amountTotal: p.amountTotal,
            note: p.note ?? null,
            appointmentId: p.appointmentId,
            serviceName: p.appointment?.service?.nombre ?? "",
            patientName:
                [p.appointment?.patient?.nombre, p.appointment?.patient?.apellido]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || p.appointment?.patient?.user?.email || "",
            professionalName:
                [p.appointment?.professional?.nombre, p.appointment?.professional?.apellido]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || p.appointment?.professional?.user?.email || "",
            apptDate: p.appointment?.fecha ?? null, // ← FECHA EFECTIVA DE LA CONSULTA
        }));

        return NextResponse.json({ count: data.length, items: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
