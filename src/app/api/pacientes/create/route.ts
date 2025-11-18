export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const ALLOWED_ROLES = new Set<Role>([Role.RECEPCION, Role.PROFESIONAL, Role.ADMIN]);

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }
        if (!ALLOWED_ROLES.has(session.role as Role)) {
            return NextResponse.json({ error: "No tienes permiso para crear pacientes" }, { status: 403 });
        }

        const body = (await req.json()) as any;
        const {
            nombre,
            apellido,
            email,
            password,
            telefono,
            dni,
            fechaNacimiento,
            localidad,
            tieneObraSocial,
            obraSocialNombre,
        } = body || {};

        if (!nombre || !apellido || !email || !password) {
            return NextResponse.json({ error: "Nombre, apellido, email y contraseña son requeridos" }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
        }

        const normalizedEmail = String(email).toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 });
        }

        let fechaNacimientoDate: Date | null = null;
        if (fechaNacimiento) {
            const parsed = new Date(fechaNacimiento);
            if (!isNaN(parsed.getTime())) {
                fechaNacimientoDate = parsed;
            }
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const created = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    role: Role.PACIENTE,
                    passwordChangedAt: new Date(),
                },
            });

            const patient = await tx.patientProfile.create({
                data: {
                    userId: user.id,
                    nombre,
                    apellido,
                    telefono: telefono || null,
                    dni: dni || null,
                    fechaNacimiento: fechaNacimientoDate,
                    localidad: localidad || null,
                    tieneObraSocial: !!tieneObraSocial,
                    obraSocialNombre: tieneObraSocial ? (obraSocialNombre || null) : null,
                },
            });

            return { user, patient };
        });

        return NextResponse.json({
            patient: {
                id: created.patient.id,
                nombre: created.patient.nombre,
                apellido: created.patient.apellido,
                email: created.user.email,
            }
        }, { status: 201 });
    } catch (e: any) {
        console.error("Error creando paciente", e);
        return NextResponse.json({ error: e.message || "No se pudo crear el paciente" }, { status: 500 });
    }
}
