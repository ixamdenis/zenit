// src/app/api/paciente/profesionales/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const pros = await prisma.professionalProfile.findMany({
            where: {
                // Opcional: filtrar solo los que tienen alias o están activos
            },
            orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
            include: {
                user: {
                    select: { email: true }
                }
            }
        });

        const data = pros.map(p => ({
            id: p.id,
            nombre: p.nombre,
            apellido: p.apellido,
            especialidad: p.especialidad,
            email: p.user.email, // Necesario para la API de agenda
            aliasBancario: p.aliasBancario // <-- El dato clave
        }));

        return NextResponse.json({ professionals: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}