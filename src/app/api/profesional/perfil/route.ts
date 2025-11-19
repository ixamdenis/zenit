export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function validationError(message: string) {
    const err = new Error(message);
    (err as any).status = 400;
    return err;
}

function toMinutes(time: string) {
    const [hh = "0", mm = "0"] = time.split(":");
    return Number(hh) * 60 + Number(mm);
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    return aStart < bEnd && bStart < aEnd;
}

async function getProProfile(session: any) {
    if (!session || session.role !== Role.PROFESIONAL) return null;
    return prisma.professionalProfile.findUnique({
        where: { userId: session.userId },
        include: {
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

        const [availability, rooms] = await Promise.all([
            prisma.availability.findMany({
                where: { professionalId: pro.id },
                orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
                include: { room: true }
            }),
            prisma.room.findMany({ orderBy: { nombre: "asc" } })
        ]);

        return NextResponse.json({
            profile: {
                aliasBancario: pro.aliasBancario,
                telefono: pro.telefono // <-- Devolver telefono
            },
            availability: availability.map(a => ({
                id: a.id,
                dayOfWeek: a.dayOfWeek,
                startTime: a.startTime,
                endTime: a.endTime,
                roomName: a.room?.nombre ?? 'Sin asignar',
                roomId: a.roomId ?? null
            })),
            services: pro.services.map(s => ({
                id: s.id,
                nombre: s.nombre,
                duracionMin: s.duracionMin,
                precioBase: s.precioBase
            })),
            rooms: rooms.map(r => ({ id: r.id, nombre: r.nombre }))
        });

    } catch (e: any) {
        const status = e?.status ?? 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}

// POST (Guardar Alias, Teléfono y Horarios)
type ProfileBody = {
    aliasBancario?: string;
    telefono?: string;
    availability?: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        roomId?: string | null;
    }[];
};

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        const pro = await prisma.professionalProfile.findUnique({ where: { userId: session?.userId } });
        if (!pro || session?.role !== Role.PROFESIONAL) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = (await req.json()) as ProfileBody;

        // Actualizar datos de contacto si vienen
        const updateData: any = {};
        if (body.aliasBancario !== undefined) updateData.aliasBancario = body.aliasBancario || null;
        if (body.telefono !== undefined) updateData.telefono = body.telefono || null;

        if (Object.keys(updateData).length > 0) {
            await prisma.professionalProfile.update({
                where: { id: pro.id },
                data: updateData
            });
        }

        if (body.availability) {
            const rooms = await prisma.room.findMany({ orderBy: { nombre: "asc" } });
            const roomMap = new Map(rooms.map(r => [r.id, r]));

            const normalized = body.availability.map((a, idx) => {
                const dayOfWeek = Number(a.dayOfWeek);
                if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
                    throw validationError(`Día inválido en disponibilidad #${idx + 1}`);
                }
                if (!a.startTime || !a.endTime) {
                    throw validationError(`Faltan horarios en disponibilidad #${idx + 1}`);
                }
                const roomId = a.roomId ?? undefined;
                if (!roomId || !roomMap.has(roomId)) {
                    throw validationError(`Debes elegir un consultorio válido en disponibilidad #${idx + 1}`);
                }
                const startMin = toMinutes(a.startTime);
                const endMin = toMinutes(a.endTime);
                if (startMin >= endMin) {
                    throw validationError(`El horario "desde" debe ser menor al "hasta" en disponibilidad #${idx + 1}`);
                }
                return {
                    professionalId: pro.id,
                    dayOfWeek,
                    startTime: a.startTime,
                    endTime: a.endTime,
                    roomId,
                    _startMin: startMin,
                    _endMin: endMin
                };
            });

            // Verificar solapamientos propios
            for (let i = 0; i < normalized.length; i++) {
                for (let j = i + 1; j < normalized.length; j++) {
                    const a = normalized[i];
                    const b = normalized[j];
                    if (a.dayOfWeek === b.dayOfWeek && a.roomId === b.roomId) {
                        if (rangesOverlap(a._startMin, a._endMin, b._startMin, b._endMin)) {
                            const roomName = roomMap.get(a.roomId)?.nombre ?? "Consultorio";
                            const dayName = DAY_NAMES[a.dayOfWeek] ?? `día ${a.dayOfWeek}`;
                            throw validationError(`Tienes dos horarios solapados en ${roomName} el ${dayName}.`);
                        }
                    }
                }
            }

            // Verificar solapamientos con otros
            const uniqueCombos = Array.from(new Map(normalized.map(n => [`${n.roomId}-${n.dayOfWeek}`, { roomId: n.roomId, dayOfWeek: n.dayOfWeek }])).values());
            const conflictsByKey = new Map<string, any[]>();
            for (const combo of uniqueCombos) {
                const key = `${combo.roomId}-${combo.dayOfWeek}`;
                const conflicts = await prisma.availability.findMany({
                    where: {
                        roomId: combo.roomId,
                        dayOfWeek: combo.dayOfWeek,
                        professionalId: { not: pro.id }
                    },
                    include: { professional: true }
                });
                conflictsByKey.set(key, conflicts);
            }

            for (const entry of normalized) {
                const key = `${entry.roomId}-${entry.dayOfWeek}`;
                const conflicts = conflictsByKey.get(key) ?? [];
                for (const conflict of conflicts) {
                    const conflictStart = toMinutes(conflict.startTime);
                    const conflictEnd = toMinutes(conflict.endTime);
                    if (rangesOverlap(entry._startMin, entry._endMin, conflictStart, conflictEnd)) {
                        const roomName = roomMap.get(entry.roomId)?.nombre ?? "consultorio";
                        const dayName = DAY_NAMES[entry.dayOfWeek] ?? `día ${entry.dayOfWeek}`;
                        const profName = [conflict.professional?.nombre, conflict.professional?.apellido].filter(Boolean).join(" ").trim() || "otro profesional";
                        throw validationError(`El consultorio ${roomName} ya está ocupado el ${dayName} en ese horario por ${profName}.`);
                    }
                }
            }

            const createData = normalized.map(({ _startMin, _endMin, ...rest }) => rest);

            await prisma.$transaction([
                prisma.availability.deleteMany({ where: { professionalId: pro.id } }),
                prisma.availability.createMany({ data: createData })
            ]);
        }

        return NextResponse.json({ ok: true, message: "Perfil actualizado" });
    } catch (e: any) {
        const status = e?.status ?? 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}