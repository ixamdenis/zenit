export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as any;
        const {
            // Datos de User
            email,
            password,
            role,
            // Datos de Perfil (comunes)
            nombre,
            apellido,
            fechaNacimiento,
            // Datos de Paciente
            dni,
            telefono,
            localidad,
            tieneObraSocial,
            obraSocialNombre,
            // Datos de Profesional
            especialidad,
            matriculaProvincial,
            matriculaNacional,
            aliasBancario,
            // Código de registro
            zenitCode
        } = body;

        // --- Validación de Entrada ---
        if (!email || !password || !nombre || !apellido || !role) {
            return NextResponse.json({ error: "Email, contraseña, nombre, apellido y rol son requeridos" }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
        }
        if (role !== Role.PACIENTE && role !== Role.PROFESIONAL) {
            return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
        }

        // --- Verificar si el usuario ya existe ---
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 });
        }

        // --- Verificar Código de Profesional ---
        if (role === Role.PROFESIONAL) {
            const masterCode = process.env.ZENIT_PROFESSIONAL_CODE;
            if (!masterCode) {
                console.error("Error de configuración: ZENIT_PROFESSIONAL_CODE no está definido");
                return NextResponse.json({ error: "Error de configuración del servidor." }, { status: 500 });
            }
            if (!zenitCode || zenitCode !== masterCode) {
                return NextResponse.json({ error: "Código de profesional inválido" }, { status: 403 });
            }
        }

        // --- Hashear Contraseña ---
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // --- Preparar Fecha de Nacimiento ---
        const fechaNacDate = fechaNacimiento ? new Date(fechaNacimiento) : null;

        // --- Crear Usuario y Perfil en una Transacción ---
        const newUser = await prisma.$transaction(async (tx) => {
            // 1. Crear el Usuario
            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: role,
                    passwordChangedAt: new Date(),
                },
            });

            // 2. Crear el Perfil correspondiente
            if (role === Role.PACIENTE) {
                await tx.patientProfile.create({
                    data: {
                        userId: user.id,
                        nombre: nombre,
                        apellido: apellido,
                        fechaNacimiento: fechaNacDate,
                        dni: dni,
                        telefono: telefono,
                        localidad: localidad,
                        tieneObraSocial: !!tieneObraSocial,
                        obraSocialNombre: tieneObraSocial ? obraSocialNombre : null,
                    },
                });
            } else if (role === Role.PROFESIONAL) {
                await tx.professionalProfile.create({
                    data: {
                        userId: user.id,
                        nombre: nombre,
                        apellido: apellido,
                        fechaNacimiento: fechaNacDate,
                        especialidad: especialidad,
                        matriculaProvincial: matriculaProvincial,
                        matriculaNacional: matriculaNacional,
                        aliasBancario: aliasBancario,
                    },
                });
            }

            return user;
        });

        // Excluir la contraseña del objeto de respuesta
        const { password: _, ...userWithoutPassword } = newUser;

        return NextResponse.json({
            message: "Usuario creado exitosamente",
            user: userWithoutPassword,
        }, { status: 201 });

    } catch (e: any) {
        console.error("Error en registro:", e);
        return NextResponse.json({ error: e.message || "Error al registrar usuario" }, { status: 500 });
    }
}