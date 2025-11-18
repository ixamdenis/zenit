export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();
const BLOCK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (!user) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const lastChange = user.passwordChangedAt ?? user.createdAt ?? new Date(0);
        const nextAllowed = new Date(lastChange.getTime() + BLOCK_WINDOW_MS);
        const canChange = Date.now() >= nextAllowed.getTime();

        return NextResponse.json({
            canChange,
            lastChangedAt: lastChange.toISOString(),
            nextAllowedChange: nextAllowed.toISOString(),
        });
    } catch (e: any) {
        console.error("Error leyendo password meta", e);
        return NextResponse.json({ error: e.message || "No se pudo obtener la información" }, { status: 500 });
    }
}
