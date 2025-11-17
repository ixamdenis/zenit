export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

async function getProProfile(session: any) {
    if (!session || session.role !== Role.PROFESIONAL) return null;
    return prisma.professionalProfile.findUnique({
        where: { userId: session.userId },
        include: {
            // Incluimos los servicios en la búsqueda del perfil
            services: {
                orderBy: { nombre: 'asc' }
            }
        }
    });
}

export async function GET() {
    try {
        const session = await getSession();
        const pro = await getProProfile(session);
        if (!pro) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const availability = await prisma.availability.findMany({
            where: { professionalId: pro.id },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            include: { room: true }
        });

        return NextResponse.json({
            profile: {
                aliasBancario: pro.aliasBancario,
            },
            availability: availability.map(a => ({
                id: a.id,
                dayOfWeek: a.dayOfWeek,
                startTime: a.startTime,
                endTime: a.endTime,
                roomName: a.room?.nombre ?? 'Sin asignar'
            })),
            // Devolvemos los servicios propios
            services: pro.services.map(s => ({
                id: s.id,
                nombre: s.nombre,
                duracionMin: s.duracionMin,
                precioBase: s.precioBase
            }))
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST (Guardar Alias y Horarios)
type ProfileBody = {
    aliasBancario?: string;
    availability?: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
    }[];
};

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        // Buscamos perfil simple para el update
        const pro = await prisma.professionalProfile.findUnique({ where: { userId: session?.userId } });
        if (!pro || session?.role !== Role.PROFESIONAL) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = (await req.json()) as ProfileBody;

        if (body.aliasBancario !== undefined) {
            await prisma.professionalProfile.update({
                where: { id: pro.id },
                data: { aliasBancario: body.aliasBancario || null }
            });
        }

        if (body.availability) {
            const newAvailabilities = body.availability.map(a => ({
                professionalId: pro.id,
                dayOfWeek: Number(a.dayOfWeek),
                startTime: a.startTime,
                endTime: a.endTime,
            }));

            await prisma.$transaction([
                prisma.availability.deleteMany({ where: { professionalId: pro.id } }),
                prisma.availability.createMany({ data: newAvailabilities })
            ]);
        }

        return NextResponse.json({ ok: true, message: "Perfil actualizado" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}