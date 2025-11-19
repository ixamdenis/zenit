export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== Role.ADMIN) {
        throw new Error("Acceso denegado: Se requieren permisos de Super Admin.");
    }
    return session;
}

// GET: Listar usuarios
export async function GET() {
    try {
        await checkAdmin();

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                patient: true,
                prof: true,
                recep: true
            }
        });

        const data = users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            nombreDisplay: u.patient?.nombre || u.prof?.nombre || u.recep?.nombre || "Admin",
            apellidoDisplay: u.patient?.apellido || u.prof?.apellido || u.recep?.apellido || "System",
            detailsDisplay: u.patient ? `Paciente (DNI: ${u.patient.dni})`
                : u.prof ? `Profesional (${u.prof.especialidad})`
                    : u.recep ? `Recepción`
                        : "Super Admin",
            patient: u.patient,
            prof: u.prof,
            recep: u.recep
        }));

        return NextResponse.json({ users: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 403 });
    }
}

// POST: Crear NUEVO usuario (Soporte para TODOS los roles)
export async function POST(req: NextRequest) {
    try {
        await checkAdmin();
        const body = await req.json();
        const {
            email, password, role, nombre, apellido,
            dni, telefono, direccion, aliasCbu, // Datos Recepción / Comunes
            fechaNacimiento, localidad, obraSocialNombre, telefonoEmergencia, // Datos Paciente
            especialidad, matriculaProvincial, matriculaNacional, aliasBancario // Datos Profesional
        } = body;

        if (!email || !password || !role || !nombre || !apellido) {
            return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return NextResponse.json({ error: "El email ya existe" }, { status: 400 });

        const hashedPassword = await bcrypt.hash(password, 10);
        // Convertir fecha si viene string
        const fechaNacDate = fechaNacimiento ? new Date(fechaNacimiento) : null;

        await prisma.$transaction(async (tx) => {
            // 1. Crear Usuario Base
            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: role as Role,
                    mustChangePassword: true
                }
            });

            // 2. Crear Perfil según el Rol
            if (role === Role.RECEPCION) {
                await tx.receptionProfile.create({
                    data: { userId: user.id, nombre, apellido, dni, telefono, direccion, aliasCbu }
                });
            }
            else if (role === Role.PACIENTE) {
                await tx.patientProfile.create({
                    data: {
                        userId: user.id, nombre, apellido, dni, telefono, localidad,
                        fechaNacimiento: fechaNacDate,
                        tieneObraSocial: !!obraSocialNombre,
                        obraSocialNombre: obraSocialNombre || null,
                        telefonoEmergencia: telefonoEmergencia || null // Nuevo campo
                    }
                });
            }
            else if (role === Role.PROFESIONAL) {
                await tx.professionalProfile.create({
                    data: {
                        userId: user.id, nombre, apellido,
                        fechaNacimiento: fechaNacDate,
                        especialidad, matriculaProvincial, matriculaNacional, aliasBancario,
                        telefono: telefono || null // Guardamos el teléfono del profesional
                    }
                });
            }
        });

        return NextResponse.json({ ok: true, message: "Usuario creado correctamente" });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PUT: Editar usuario existente
export async function PUT(req: NextRequest) {
    try {
        await checkAdmin();
        const body = await req.json();
        const { id, email, ...data } = body;

        if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

        const user = await prisma.user.findUnique({
            where: { id },
            include: { patient: true, prof: true, recep: true }
        });

        if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

        // Convertir fecha si viene para update
        const fechaNacDate = data.fechaNacimiento ? new Date(data.fechaNacimiento) : null;

        await prisma.$transaction(async (tx) => {
            // 1. Actualizar Email
            if (email && email !== user.email) {
                await tx.user.update({ where: { id }, data: { email } });
            }

            // 2. Actualizar Perfil según Rol
            if (user.role === Role.PACIENTE && user.patient) {
                await tx.patientProfile.update({
                    where: { id: user.patient.id },
                    data: {
                        nombre: data.nombre,
                        apellido: data.apellido,
                        dni: data.dni,
                        telefono: data.telefono,
                        localidad: data.localidad,
                        obraSocialNombre: data.obraSocialNombre,
                        tieneObraSocial: !!data.obraSocialNombre,
                        fechaNacimiento: fechaNacDate,
                        telefonoEmergencia: data.telefonoEmergencia // Nuevo campo
                    }
                });
            } else if (user.role === Role.PROFESIONAL && user.prof) {
                await tx.professionalProfile.update({
                    where: { id: user.prof.id },
                    data: {
                        nombre: data.nombre,
                        apellido: data.apellido,
                        especialidad: data.especialidad,
                        matriculaProvincial: data.matriculaProvincial,
                        matriculaNacional: data.matriculaNacional,
                        aliasBancario: data.aliasBancario,
                        fechaNacimiento: fechaNacDate,
                        telefono: data.telefono // Actualizar tel profesional
                    }
                });
            } else if (user.role === Role.RECEPCION && user.recep) {
                await tx.receptionProfile.update({
                    where: { id: user.recep.id },
                    data: {
                        nombre: data.nombre,
                        apellido: data.apellido,
                        dni: data.dni,
                        telefono: data.telefono,
                        direccion: data.direccion,
                        aliasCbu: data.aliasCbu
                    }
                });
            }
        });

        return NextResponse.json({ ok: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Borrar usuario
export async function DELETE(req: NextRequest) {
    try {
        const session = await checkAdmin();
        const { searchParams } = new URL(req.url);
        const idToDelete = searchParams.get("id");

        if (!idToDelete) return NextResponse.json({ error: "Falta ID" }, { status: 400 });
        if (idToDelete === session.userId) return NextResponse.json({ error: "No te auto-elimines." }, { status: 400 });

        // Limpieza de Profesional
        const prof = await prisma.professionalProfile.findUnique({ where: { userId: idToDelete } });
        if (prof) {
            await prisma.professionalService.deleteMany({ where: { professionalId: prof.id } });
            await prisma.availability.deleteMany({ where: { professionalId: prof.id } });
            await prisma.appointment.deleteMany({ where: { professionalId: prof.id } });
            await prisma.professionalProfile.delete({ where: { id: prof.id } });
        }

        // Limpieza de Paciente
        const pat = await prisma.patientProfile.findUnique({ where: { userId: idToDelete } });
        if (pat) {
            await prisma.appointment.deleteMany({ where: { patientId: pat.id } });
            await prisma.patientProfile.delete({ where: { id: pat.id } });
        }

        // Limpieza de Recepción
        const recep = await prisma.receptionProfile.findUnique({ where: { userId: idToDelete } });
        if (recep) {
            await prisma.receptionProfile.delete({ where: { id: recep.id } });
        }

        await prisma.user.delete({ where: { id: idToDelete } });

        return NextResponse.json({ ok: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}