export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();
const GENERIC_PASSWORD = "Zenit123";
const SALT_ROUNDS = 10;

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();

        const allowedRoles: Role[] = [Role.PROFESIONAL, Role.RECEPCION, Role.ADMIN];

        if (!session || !allowedRoles.includes(session.role)) {
            return NextResponse.json({ error: "No autorizado para crear pacientes." }, { status: 401 });
        }

        const body = await req.json();
        const { nombre, apellido, email, dni, telefono, fechaNacimiento, localidad, tieneObraSocial, obraSocialNombre, hasNoEmail } = body;

        // --- Lógica de Email / DNI ---
        const isDNIUser = !!hasNoEmail;
        let finalEmail = email ? email.toLowerCase() : '';

        if (!nombre || !apellido || !dni) {
            return NextResponse.json({ error: "Nombre, Apellido y DNI son obligatorios" }, { status: 400 });
        }

        if (!isDNIUser && !finalEmail) {
            return NextResponse.json({ error: "Se requiere Email o marcar 'No tiene email'" }, { status: 400 });
        }

        if (isDNIUser) {
            // Generamos un email único y reservado para el login por DNI
            finalEmail = `dni-${dni.replace(/[^0-9]/g, '')}@nodireccion.zenit`;
        }
        // -----------------------------

        // Verificar si el email (finalEmail) ya existe
        const existing = await prisma.user.findUnique({ where: { email: finalEmail } });
        if (existing) {
            // Si el email ya existe, puede ser por un DNI duplicado si es un DNIUser
            if (isDNIUser) {
                return NextResponse.json({ error: "El DNI ya está asociado a una cuenta" }, { status: 400 });
            }
            return NextResponse.json({ error: "El email ya está en uso" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(GENERIC_PASSWORD, SALT_ROUNDS);
        const fechaNacDate = fechaNacimiento ? new Date(fechaNacimiento) : null;

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: finalEmail,
                    password: hashedPassword,
                    role: Role.PACIENTE,
                    mustChangePassword: true,
                    isDNIUser: isDNIUser, // <--- CAMPO QUE PRISMA DEBE RECONOCER
                }
            });

            await tx.patientProfile.create({
                data: {
                    userId: user.id,
                    nombre,
                    apellido,
                    dni,
                    telefono: telefono || null,
                    fechaNacimiento: fechaNacDate,
                    localidad: localidad || null,
                    tieneObraSocial: !!tieneObraSocial,
                    obraSocialNombre: (!!tieneObraSocial && obraSocialNombre) ? obraSocialNombre : null
                }
            });
        });

        const loginUser = isDNIUser ? `DNI ${dni}` : finalEmail;
        return NextResponse.json({ ok: true, message: `Paciente creado. Usuario de login: ${loginUser}. Contraseña temporal: ${GENERIC_PASSWORD}` });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Error creando paciente" }, { status: 500 });
    }
}