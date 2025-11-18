import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// --- INICIO: CAMBIO ---
// La función 'ensureService' se elimina, ya no la necesitamos.
// --- FIN: CAMBIO ---


async function main() {
    // Rooms
    const [roomA, roomB] = await prisma.$transaction([
        prisma.room.upsert({
            where: { nombre: "Calma" },
            update: {},
            create: { nombre: "Calma" }
        }),
        prisma.room.upsert({
            where: { nombre: "Armonía" },
            update: {},
            create: { nombre: "Armonía" }
        })
    ]);

    // Encriptamos las contraseñas
    const passAdmin = await bcrypt.hash("admin123456", SALT_ROUNDS);
    const passRecep = await bcrypt.hash("recep123456", SALT_ROUNDS);
    const passPro = await bcrypt.hash("pro123", SALT_ROUNDS);
    const passPac = await bcrypt.hash("pac123", SALT_ROUNDS);

    // Creamos el usuario ADMIN
    await prisma.user.upsert({
        where: { email: "admin@zenit.local" },
        update: { password: passAdmin, passwordChangedAt: new Date() },
        create: {
            email: "admin@zenit.local",
            password: passAdmin,
            role: "ADMIN",
            passwordChangedAt: new Date()
        }
    });

    // Creamos el usuario RECEPCION
    await prisma.user.upsert({
        where: { email: "recepcion@zenit.local" },
        update: { password: passRecep, passwordChangedAt: new Date() },
        create: {
            email: "recepcion@zenit.local",
            password: passRecep,
            role: "RECEPCION",
            passwordChangedAt: new Date()
        }
    });

    // Usuario Profesional
    const proUser = await prisma.user.upsert({
        where: { email: "pro@zenit.local" },
        update: { password: passPro, passwordChangedAt: new Date() },
        create: { email: "pro@zenit.local", password: passPro, role: "PROFESIONAL", passwordChangedAt: new Date() }
    });

    // Usuario Paciente
    const pacUser = await prisma.user.upsert({
        where: { email: "paciente@zenit.local" },
        update: { password: passPac, passwordChangedAt: new Date() },
        create: { email: "paciente@zenit.local", password: passPac, role: "PACIENTE", passwordChangedAt: new Date() }
    });

    // Perfil Profesional
    const prof = await prisma.professionalProfile.upsert({
        where: { userId: proUser.id },
        update: {},
        create: {
            userId: proUser.id,
            nombre: "Ana",
            apellido: "García",
            especialidad: "Clínica",
            colorAgenda: "#4f46e5",
            aliasBancario: "ana.garcia.zenit" // <-- Agregamos un alias
        }
    });

    // Perfil Paciente
    await prisma.patientProfile.upsert({
        where: { userId: pacUser.id },
        update: {},
        create: {
            userId: pacUser.id,
            nombre: "Juan",
            apellido: "Pérez",
            telefono: "123456789"
        }
    });

    // --- INICIO: CAMBIO ---
    // Creamos los servicios PARA LA PROFESIONAL "Ana García"

    // 1. Borramos servicios antiguos que pudiera tener (limpieza)
    await prisma.professionalService.deleteMany({
        where: { professionalId: prof.id }
    });

    // 2. Creamos sus nuevos servicios
    await prisma.professionalService.createMany({
        data: [
            {
                nombre: "Consulta Individual",
                duracionMin: 45,
                precioBase: 15000,
                professionalId: prof.id
            },
            {
                nombre: "Consulta de Pareja",
                duracionMin: 60,
                precioBase: 22000,
                professionalId: prof.id
            }
        ]
    });
    // --- FIN: CAMBIO ---


    // Disponibilidad de Ana García
    await prisma.availability.deleteMany({ where: { professionalId: prof.id } }); // Limpiamos
    await prisma.availability.createMany({
        data: [
            {
                professionalId: prof.id,
                dayOfWeek: 1, // Lunes
                startTime: "09:00",
                endTime: "13:00",
                roomId: roomA.id
            },
            {
                professionalId: prof.id,
                dayOfWeek: 2, // Martes
                startTime: "09:00",
                endTime: "13:00",
                roomId: roomA.id
            },
            {
                professionalId: prof.id,
                dayOfWeek: 3, // Miércoles
                startTime: "14:00",
                endTime: "18:00",
                roomId: roomB.id
            }
        ]
    });

    console.log("Seed ok (con servicios por profesional)");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });