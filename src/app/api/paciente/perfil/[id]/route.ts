export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

// En Next.js 15+, 'params' es una Promise
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();

        const allowedRoles: Role[] = [Role.ADMIN, Role.RECEPCION, Role.PROFESIONAL];

        if (!session || !allowedRoles.includes(session.role)) {
            return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
        }

        // --- CORRECCIÓN: Esperar la promesa de params ---
        const { id } = await params;
        const patientId = id;
        // ------------------------------------------------

        if (!patientId || typeof patientId !== 'string' || patientId.length === 0) {
            return NextResponse.json({ error: "ID de paciente requerido" }, { status: 400 });
        }

        const patientProfile = await prisma.patientProfile.findUnique({
            where: { id: patientId },
            include: {
                user: {
                    select: {
                        email: true,
                        createdAt: true,
                        isDNIUser: true,
                    }
                }
            }
        });

        if (!patientProfile) {
            return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
        }

        const data = {
            id: patientProfile.id,
            nombre: patientProfile.nombre,
            apellido: patientProfile.apellido,
            dni: patientProfile.dni,
            telefono: patientProfile.telefono,
            emailNotif: patientProfile.emailNotif,
            fechaNacimiento: patientProfile.fechaNacimiento,
            localidad: patientProfile.localidad,
            tieneObraSocial: patientProfile.tieneObraSocial,
            obraSocialNombre: patientProfile.obraSocialNombre,

            // Datos del User
            userEmail: patientProfile.user?.email,
            userCreatedAt: patientProfile.user?.createdAt,
            isDNIUser: patientProfile.user?.isDNIUser,
        };

        return NextResponse.json({ patient: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Error al buscar perfil" }, { status: 500 });
    }
}