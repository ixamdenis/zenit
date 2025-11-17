export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ProfessionalDump = { id: string; nombre: string; apellido: string; user: { email: string } };
type PatientDump = { id: string; nombre: string; apellido: string; user: { email: string } };
type RoomDump = { id: string; nombre: string };

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
        // Servicios globales eliminados de aquí
        const rooms = await prisma.room.findMany({ orderBy: { nombre: "asc" } });

        return NextResponse.json({
            professionals: professionals.map((p: ProfessionalDump) => ({
                professionalId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                userEmail: p.user.email
            })),
            patients: patients.map((p: PatientDump) => ({
                patientId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                userEmail: p.user.email
            })),
            // Devolvemos array vacío de servicios para no romper el frontend todavía
            services: [],
            rooms: rooms.map((r: RoomDump) => ({ roomId: r.id, nombre: r.nombre }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}