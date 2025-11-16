export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session"; // Importamos nuestra lógica

/**
 * Esta API (ruta) cierra la sesión del usuario.
 * Simplemente llama a deleteSession() para borrar la cookie.
 */
export async function POST() {
    try {
        await deleteSession();
        return NextResponse.json({ ok: true, message: "Sesión cerrada" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}