export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { getSession, createSession } from "@/lib/session";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { newPassword } = await req.json();
        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
        }

        // Hashear nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Actualizar usuario
        const updatedUser = await prisma.user.update({
            where: { id: session.userId },
            data: {
                password: hashedPassword,
                mustChangePassword: false // <--- Ya la cambió
            },
            include: {
                patient: true,
                prof: true
            }
        });

        // ACTUALIZAR LA SESIÓN (para quitar el flag mustChangePassword de la cookie actual)
        // Volvemos a generar la cookie limpia
        let nombre = session.nombre; // Mantenemos el nombre que ya tenía
        await createSession({
            userId: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            nombre: nombre,
            mustChangePassword: false
        });

        return NextResponse.json({ ok: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}