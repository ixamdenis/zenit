export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Definiciones de tipos simplificados para evitar errores de "implicit any"
// Estos tipos coinciden con la estructura de datos que traen las consultas de Prisma
type ProfessionalDump = { id: string; nombre: string; apellido: string; user: { email: string } };
type PatientDump = { id: string; nombre: string; apellido: string; user: { email: string } };
type ServiceDump = { id: string; nombre: string; duracionMin: number; precioBase: number };
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
        const services = await prisma.service.findMany({ orderBy: { nombre: "asc" } });
        const rooms = await prisma.room.findMany({ orderBy: { nombre: "asc" } });

        return NextResponse.json({
            // Se usa el tipo ProfessionalDump para evitar errores de 'implicit any' en 'p'
            professionals: professionals.map((p: ProfessionalDump) => ({
                professionalId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                userEmail: p.user.email
            })),
            // Se usa el tipo PatientDump para evitar errores de 'implicit any' en 'p'
            patients: patients.map((p: PatientDump) => ({
                patientId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                userEmail: p.user.email
            })),
            // Se usa el tipo ServiceDump para evitar errores de 'implicit any' en 's'
            services: services.map((s: ServiceDump) => ({
                serviceId: s.id,
                nombre: s.nombre,
                duracionMin: s.duracionMin,
                precioBase: s.precioBase
            })),
            // Se usa el tipo RoomDump para evitar errores de 'implicit any' en 'r'
            rooms: rooms.map((r: RoomDump) => ({ roomId: r.id, nombre: r.nombre }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}