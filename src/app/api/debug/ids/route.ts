export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const pro = await prisma.professionalProfile.findFirst({
            include: { user: true }
        });
        const pac = await prisma.patientProfile.findFirst({
            include: { user: true }
        });
        const service = await prisma.service.findFirst();
        const rooms = await prisma.room.findMany();

        return NextResponse.json({
            professional: pro
                ? { id: pro.id, nombre: pro.nombre, apellido: pro.apellido, userEmail: pro.user.email }
                : null,
            patient: pac
                ? { id: pac.id, nombre: pac.nombre, apellido: pac.apellido, userEmail: pac.user.email }
                : null,
            service: service ? { id: service.id, nombre: service.nombre, duracionMin: service.duracionMin } : null,
            rooms: rooms.map((r) => ({ id: r.id, nombre: r.nombre }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
