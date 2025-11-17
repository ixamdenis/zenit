export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get("email");
        const id = searchParams.get("id");

        if (!email && !id) {
            return NextResponse.json({ error: "Falta email o id del profesional" }, { status: 400 });
        }

        let professionalId = id;

        // Si viene email, buscamos el ID del profesional asociado
        if (email && !id) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                const pro = await prisma.professionalProfile.findUnique({ where: { userId: user.id } });
                professionalId = pro?.id || null;
            }
        }

        if (!professionalId) {
            return NextResponse.json({ services: [] }); // No se encontró profesional
        }

        // Buscar servicios EXCLUSIVOS de ese profesional
        const services = await prisma.professionalService.findMany({
            where: { professionalId },
            orderBy: { nombre: "asc" }
        });

        return NextResponse.json({
            services: services.map(s => ({
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