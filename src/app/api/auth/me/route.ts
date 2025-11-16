export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Esta API (ruta) es para el lado del cliente (Client Components).
 * Permite al navegador preguntar "¿Quién soy?" al servidor.
 * El servidor lee la cookie de sesión (que es httpOnly)
 * y devuelve los datos del usuario si la sesión es válida.
 */
export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({ user: null, error: "No autenticado" }, { status: 401 });
        }

        // Devolvemos los datos del usuario que están en la sesión
        return NextResponse.json({ user: session });

    } catch (e: any) {
        return NextResponse.json({ user: null, error: e.message }, { status: 500 });
    }
}