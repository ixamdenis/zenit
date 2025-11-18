export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createSession, SessionPayload } from "@/lib/session";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as any;
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: {
                patient: true,
                prof: true,
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
        }

        let nombre = "Usuario";
        if (user.role === 'PACIENTE' && user.patient) {
            nombre = user.patient.nombre;
        } else if (user.role === 'PROFESIONAL' && user.prof) {
            nombre = user.prof.nombre;
        } else if (user.role === 'RECEPCION' || user.role === 'ADMIN') {
            nombre = user.email.split('@')[0];
        }

        // El campo mustChangePassword existe después de npx prisma generate
        const sessionPayload: SessionPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            nombre: nombre,
            mustChangePassword: user.mustChangePassword
        };

        await createSession(sessionPayload);

        return NextResponse.json({ ok: true, message: "Login exitoso" });

    } catch (e: any) {
        console.error("Error en login:", e);
        return NextResponse.json({ error: e.message || "Error al iniciar sesión" }, { status: 500 });
    }
}