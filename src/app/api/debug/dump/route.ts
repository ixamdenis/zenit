export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const professionals = await prisma.professionalProfile.findMany({
            include: { user: true },
            orderBy: { apellido: "asc" }
        });
        const patients = await prisma.patientProfile.findMany({
            include: { user: true },
            orderBy: { apellido: "asc" }
        });
        const services = await prisma.service.findMany({ orderBy: { nombre: "asc" } });
        const rooms = await prisma.room.findMany({ orderBy: { nombre: "asc" } });

        return NextResponse.json({
            professionals: professionals.map(p => ({
                professionalId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                userEmail: p.user.email
            })),
            patients: patients.map(p => ({
                patientId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                userEmail: p.user.email
            })),
            services: services.map(s => ({
                serviceId: s.id,
                nombre: s.nombre,
                duracionMin: s.duracionMin,
                precioBase: s.precioBase
            })),
            rooms: rooms.map(r => ({ roomId: r.id, nombre: r.nombre }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
