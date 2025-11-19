export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// En Next.js 15+, 'params' es una Promise
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // --- CORRECCIÓN: Esperar la promesa de params ---
        const { id } = await params;
        const professionalId = id;
        // ------------------------------------------------

        if (!professionalId || typeof professionalId !== 'string' || professionalId.length === 0) {
            return NextResponse.json({ error: "ID de profesional requerido" }, { status: 400 });
        }

        const professional = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            select: {
                nombre: true,
                apellido: true,
                especialidad: true,
                matriculaProvincial: true,
                matriculaNacional: true,
                user: { select: { email: true } },
                availabilities: {
                    select: {
                        dayOfWeek: true,
                        startTime: true,
                        endTime: true,
                    },
                    orderBy: { dayOfWeek: "asc" }
                },
                services: {
                    select: {
                        id: true,
                        nombre: true,
                        duracionMin: true,
                        precioBase: true,
                    },
                    orderBy: { precioBase: "asc" }
                }
            }
        });

        if (!professional) {
            return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
        }

        const data = {
            nombreCompleto: `${professional.nombre} ${professional.apellido}`,
            especialidad: professional.especialidad,
            matriculaProvincial: professional.matriculaProvincial,
            matriculaNacional: professional.matriculaNacional,
            email: professional.user.email,
            // Agrupamos la disponibilidad por día de la semana para el frontend
            availabilities: professional.availabilities.reduce((acc: Record<number, string[]>, a) => {
                if (!acc[a.dayOfWeek]) acc[a.dayOfWeek] = [];
                acc[a.dayOfWeek].push(`${a.startTime} a ${a.endTime}`);
                return acc;
            }, {}),
            services: professional.services,
        };

        return NextResponse.json({ professional: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Error al buscar perfil público" }, { status: 500 });
    }
}