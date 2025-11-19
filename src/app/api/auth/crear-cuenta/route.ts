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
            telefono, // Se usa para Paciente y ahora también para Profesional
            localidad,
            tieneObraSocial,
            obraSocialNombre,
            hasNoEmail, // Flag para usuario DNI
            // Datos de Profesional
            especialidad,
            matriculaProvincial,
            matriculaNacional,
            aliasBancario,
            // Código de registro
            zenitCode
        } = body;

        // --- Validación de Entrada ---
        if (!password || !nombre || !apellido || !role) {
            return NextResponse.json({ error: "Faltan datos obligatorios." }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
        }
        if (role !== Role.PACIENTE && role !== Role.PROFESIONAL) {
            return NextResponse.json({ error: "Rol inválido para registro público" }, { status: 400 });
        }

        // Validar Email vs DNI
        if (role === Role.PACIENTE && hasNoEmail && !dni) {
            return NextResponse.json({ error: "DNI requerido si no tiene email" }, { status: 400 });
        }
        if (!hasNoEmail && !email) {
            return NextResponse.json({ error: "Email requerido" }, { status: 400 });
        }

        // Determinar email final
        let finalEmail = email ? email.toLowerCase() : "";
        if (role === Role.PACIENTE && hasNoEmail) {
            finalEmail = `dni-${dni.replace(/[^0-9]/g, '')}@nodireccion.zenit`;
        }

        // --- Verificar si el usuario ya existe ---
        const existingUser = await prisma.user.findUnique({
            where: { email: finalEmail },
        });

        if (existingUser) {
            return NextResponse.json({ error: "El usuario (email o DNI) ya existe" }, { status: 409 });
        }

        // --- Verificar Código de Profesional ---
        if (role === Role.PROFESIONAL) {
            const masterCode = process.env.ZENIT_PROFESSIONAL_CODE;
            if (!masterCode) {
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
                    email: finalEmail,
                    password: hashedPassword,
                    role: role,
                    isDNIUser: !!hasNoEmail,
                    mustChangePassword: false
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
                        telefono: telefono // <--- GUARDAMOS EL TELEFONO DEL PROFESIONAL
                    },
                });
            }

            return user;
        });

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