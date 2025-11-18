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
        // Recibe y desestructura todos los campos del formulario de registro
        const { nombre, apellido, email, dni, telefono, fechaNacimiento, localidad, tieneObraSocial, obraSocialNombre } = body;

        // Validaciones clave (DNI obligatorio)
        if (!nombre || !apellido || !email || !dni) {
            return NextResponse.json({ error: "Nombre, Apellido, Email y DNI son obligatorios" }, { status: 400 });
        }

        // Verificar si el email ya existe
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: "Ese email ya está registrado." }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(GENERIC_PASSWORD, SALT_ROUNDS);
        const fechaNacDate = fechaNacimiento ? new Date(fechaNacimiento) : null;

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: Role.PACIENTE,
                    mustChangePassword: true,
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

        return NextResponse.json({ ok: true, message: "Paciente creado. Contraseña temporal: " + GENERIC_PASSWORD });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Error creando paciente" }, { status: 500 });
    }
}