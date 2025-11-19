export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

// GET: Obtener datos actuales
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const patient = await prisma.patientProfile.findUnique({
            where: { userId: session.userId },
            include: { user: { select: { email: true } } }
        });

        if (!patient) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

        return NextResponse.json({
            ...patient,
            email: patient.user.email
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PUT: Actualizar datos
export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { telefono, localidad, tieneObraSocial, obraSocialNombre, telefonoEmergencia } = body;

        const updated = await prisma.patientProfile.update({
            where: { userId: session.userId },
            data: {
                telefono,
                localidad,
                tieneObraSocial,
                obraSocialNombre: tieneObraSocial ? obraSocialNombre : null,
                telefonoEmergencia: telefonoEmergencia // Guardar emergencia
            }
        });

        return NextResponse.json({ ok: true, patient: updated });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}