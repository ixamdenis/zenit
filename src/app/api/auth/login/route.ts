export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createSession, SessionPayload } from "@/lib/session";

const prisma = new PrismaClient();

// Helper para verificar si la entrada es un DNI (solo números)
function isDNI(input: string): boolean {
    return /^\d{7,10}$/.test(input.replace(/[^0-9]/g, ''));
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as any;
        const { email, password } = body; // 'email' contendrá DNI si se usó DNI para login

        if (!email || !password) {
            return NextResponse.json({ error: "Usuario/DNI y contraseña son requeridos" }, { status: 400 });
        }

        let user: any = null;
        const loginInput = email.toLowerCase();

        // 1. Intentar buscar por EMAIL normal (si contiene @)
        if (loginInput.includes('@')) {
            user = await prisma.user.findUnique({
                where: { email: loginInput },
                include: { patient: true, prof: true }
            });
        }

        // 2. Si no se encuentra y la entrada parece un DNI, buscar por DNI
        if (!user && isDNI(loginInput)) {
            const cleanDNI = loginInput.replace(/[^0-9]/g, '');
            // --- CORRECCIÓN: Usamos findFirst y agregamos include: { user: true } ---
            const patientProfile = await prisma.patientProfile.findFirst({
                where: { dni: cleanDNI },
                include: { user: true } // <--- INCLUIDO PARA RESOLVER EL ERROR
            });

            // Solo permitir login por DNI si el usuario tiene la bandera isDNIUser = true
            if (patientProfile?.user && patientProfile.user.isDNIUser) {
                user = patientProfile.user;
                // Adjuntamos el perfil para la lógica posterior (rol, nombre)
                user.patient = patientProfile;
                user.prof = null;
            }
        }

        if (!user) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        // 3. Comparar la contraseña
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        // 4. Determinar el nombre del usuario
        let nombre = "Usuario";
        if (user.role === 'PACIENTE' && user.patient) {
            nombre = user.patient.nombre;
        } else if (user.role === 'PROFESIONAL' && user.prof) {
            nombre = user.prof.nombre;
        } else if (user.role === 'RECEPCION' || user.role === 'ADMIN') {
            nombre = user.email.split('@')[0];
        }

        // 5. Crear el payload de la sesión
        const sessionPayload: SessionPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            nombre: nombre,
            mustChangePassword: user.mustChangePassword
        };

        // 6. Crear la sesión
        await createSession(sessionPayload);

        return NextResponse.json({ ok: true, message: "Login exitoso" });

    } catch (e: any) {
        console.error("Error en login:", e);
        return NextResponse.json({ error: e.message || "Error al iniciar sesión" }, { status: 500 });
    }
}