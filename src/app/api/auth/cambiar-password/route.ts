export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const BLOCK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const body = (await req.json()) as any;
        const { currentPassword, newPassword } = body || {};
        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "Debes completar tu contraseña actual y la nueva" }, { status: 400 });
        }
        if (newPassword.length < 6) {
            return NextResponse.json({ error: "La contraseña nueva debe tener al menos 6 caracteres" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (!user) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const lastChange = user.passwordChangedAt ?? user.createdAt ?? new Date(0);
        const nextAllowed = new Date(lastChange.getTime() + BLOCK_WINDOW_MS);
        if (Date.now() < nextAllowed.getTime()) {
            return NextResponse.json({
                error: `Solo puedes modificar tu contraseña cada 7 días. Podrás volver a hacerlo el ${nextAllowed.toLocaleDateString("es-AR")}.`,
                nextAllowedChange: nextAllowed.toISOString(),
            }, { status: 429 });
        }

        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            return NextResponse.json({ error: "La contraseña actual no es válida" }, { status: 401 });
        }

        const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashed,
                passwordChangedAt: new Date(),
            }
        });

        const nextWindow = new Date(updated.passwordChangedAt.getTime() + BLOCK_WINDOW_MS);

        return NextResponse.json({
            message: "Contraseña actualizada",
            nextAllowedChange: nextWindow.toISOString(),
        });
    } catch (e: any) {
        console.error("Error cambiando contraseña", e);
        return NextResponse.json({ error: e.message || "No se pudo cambiar la contraseña" }, { status: 500 });
    }
}
