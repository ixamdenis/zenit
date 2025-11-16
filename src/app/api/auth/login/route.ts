export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createSession, SessionPayload } from "@/lib/session"; // Importamos nuestra lógica

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as any;
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
        }

        // 1. Buscar al usuario y su perfil (para obtener el nombre)
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: {
                patient: true, // Incluir perfil de paciente
                prof: true,    // Incluir perfil de profesional
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
        }

        // 2. Comparar la contraseña enviada con la guardada (hasheada)
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
        }

        // 3. Determinar el nombre del usuario desde su perfil
        let nombre = "Usuario"; // Fallback
        if (user.role === 'PACIENTE' && user.patient) {
            nombre = user.patient.nombre;
        } else if (user.role === 'PROFESIONAL' && user.prof) {
            nombre = user.prof.nombre;
        } else if (user.role === 'RECEPCION' || user.role === 'ADMIN') {
            nombre = user.email.split('@')[0]; // Usar el email como nombre para admin/recepción
        }

        // 4. Crear el payload de la sesión
        const sessionPayload: SessionPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            nombre: nombre, // Guardamos el nombre para el "Hola, Juan"
        };

        // 5. Crear la sesión (esto setea la cookie)
        await createSession(sessionPayload);

        return NextResponse.json({ ok: true, message: "Login exitoso" });

    } catch (e: any) {
        console.error("Error en login:", e);
        return NextResponse.json({ error: e.message || "Error al iniciar sesión" }, { status: 500 });
    }
}