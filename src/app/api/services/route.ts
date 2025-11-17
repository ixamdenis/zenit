export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

// POST: Crear servicio (Igual que antes)
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== Role.PROFESIONAL) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const pro = await prisma.professionalProfile.findUnique({
            where: { userId: session.userId }
        });
        if (!pro) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

        const body = (await req.json()) as { nombre: string; duracionMin: number; precioBase: number };
        if (!body.nombre || !body.duracionMin || !body.precioBase) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        const service = await prisma.professionalService.create({
            data: {
                nombre: body.nombre,
                duracionMin: Number(body.duracionMin),
                precioBase: Number(body.precioBase),
                professionalId: pro.id
            }
        });

        return NextResponse.json({ ok: true, service });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Borrar servicio (MODIFICADO PARA BORRADO EN CASCADA)
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== Role.PROFESIONAL) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const serviceId = searchParams.get("id");
        if (!serviceId) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

        const pro = await prisma.professionalProfile.findUnique({ where: { userId: session.userId } });
        const service = await prisma.professionalService.findUnique({ where: { id: serviceId } });

        if (!service || service.professionalId !== pro?.id) {
            return NextResponse.json({ error: "Servicio no encontrado o no te pertenece" }, { status: 403 });
        }

        // --- INICIO: LIMPIEZA EN CASCADA ---
        // 1. Buscamos los IDs de todos los turnos que usen este servicio
        const appointments = await prisma.appointment.findMany({
            where: { professionalServiceId: serviceId },
            select: { id: true }
        });
        const apptIds = appointments.map(a => a.id);

        if (apptIds.length > 0) {
            // 2. Borramos Pagos asociados a esos turnos
            await prisma.payment.deleteMany({
                where: { appointmentId: { in: apptIds } }
            });

            // 3. Borramos Cancelaciones asociadas
            await prisma.cancellation.deleteMany({
                where: { appointmentId: { in: apptIds } }
            });

            // 4. Borramos los Turnos
            await prisma.appointment.deleteMany({
                where: { id: { in: apptIds } }
            });
        }
        // --- FIN: LIMPIEZA EN CASCADA ---

        // 5. Ahora sí, borramos el servicio (ya no tiene ataduras)
        await prisma.professionalService.delete({ where: { id: serviceId } });

        return NextResponse.json({ ok: true, message: "Servicio eliminado y datos limpiados." });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}