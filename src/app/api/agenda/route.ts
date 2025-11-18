export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toDateAt(timeHHMM: string, base: Date) {
    const [hh, mm] = timeHHMM.split(":").map(Number);
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
}

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get("date");
        const professionalId = searchParams.get("professionalId");
        const professionalEmail = searchParams.get("professionalEmail");
        const serviceName = searchParams.get("serviceName");
        const ignoreAppointmentId = searchParams.get("ignoreAppointmentId");

        if (!dateStr || (!professionalId && !professionalEmail)) {
            return NextResponse.json(
                { error: "Parámetros requeridos: date y (professionalId o professionalEmail)" },
                { status: 400 }
            );
        }

        const base = new Date(dateStr + "T00:00:00");
        const dayOfWeek = base.getDay();

        // Resolver profesional
        let prof: { id: string } | null = null;
        if (professionalId) {
            prof = await prisma.professionalProfile.findUnique({ where: { id: professionalId }, select: { id: true } });
        } else if (professionalEmail) {
            const u = await prisma.user.findUnique({ where: { email: professionalEmail }, select: { id: true } });
            if (u) prof = await prisma.professionalProfile.findUnique({ where: { userId: u.id }, select: { id: true } });
        }
        if (!prof) return NextResponse.json({ error: "Profesional no existe" }, { status: 404 });

        const availability = await prisma.availability.findMany({
            where: { professionalId: prof.id, dayOfWeek }
        });
        if (availability.length === 0) return NextResponse.json({ slots: [], professionalId: prof.id });

        // --- CAMBIO: Buscar servicio del profesional ---
        let dur = 30; // Default
        if (serviceName) {
            const service = await prisma.professionalService.findFirst({
                where: {
                    nombre: serviceName,
                    professionalId: prof.id // <--- Filtro clave
                }
            });
            if (service) dur = service.duracionMin;
        }

        const startDay = new Date(base);
        const endDay = new Date(base); endDay.setHours(23, 59, 59, 999);

        const booked = await prisma.appointment.findMany({
            where: {
                professionalId: prof.id,
                fecha: { gte: startDay, lte: endDay },
                estado: { in: ["RESERVADO", "CONFIRMADO"] },
                ...(ignoreAppointmentId ? { NOT: { id: ignoreAppointmentId } } : {})
            },
            select: { fecha: true, horaFin: true }
        });

        const slots: string[] = [];
        const now = new Date();
        const sameDayAsToday = base.getFullYear() === now.getFullYear()
            && base.getMonth() === now.getMonth()
            && base.getDate() === now.getDate();

        for (const a of availability) {
            let cursor = toDateAt(a.startTime, base);
            const end = toDateAt(a.endTime, base);
            while (addMinutes(cursor, dur) <= end) {
                const endSlot = addMinutes(cursor, dur);
                const overlap = booked.some(b => !(endSlot <= b.fecha || cursor >= b.horaFin));
                const isPast = sameDayAsToday && endSlot <= now;
                if (!overlap && !isPast) slots.push(cursor.toISOString());
                cursor = endSlot;
            }
        }

        return NextResponse.json({ slots, professionalId: prof.id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}