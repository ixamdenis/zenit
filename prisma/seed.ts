import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureService(
    nombre: string,
    duracionMin: number,
    precioBase: number,
    requierePagoPrevio = false,
    penalidadPorcentaje?: number
) {
    const existing = await prisma.service.findFirst({ where: { nombre } });
    if (existing) return existing;
    return prisma.service.create({
        data: { nombre, duracionMin, precioBase, requierePagoPrevio, penalidadPorcentaje }
    });
}

async function main() {
    // Rooms (Room.nombre es @unique)
    const [roomA, roomB] = await prisma.$transaction([
        prisma.room.upsert({
            where: { nombre: "Consultorio A" },
            update: {},
            create: { nombre: "Consultorio A" }
        }),
        prisma.room.upsert({
            where: { nombre: "Consultorio B" },
            update: {},
            create: { nombre: "Consultorio B" }
        })
    ]);

    // Service (en el schema actual Service.nombre NO es @unique, por eso no usamos upsert)
    await ensureService("Consulta", 30, 150000, false, 0.5);

    // Users demo (User.email es @unique)
    await prisma.user.upsert({
        where: { email: "recepcion@zenit.local" },
        update: {},
        create: { email: "recepcion@zenit.local", password: "recep123", role: "RECEPCION" }
    });

    const proUser = await prisma.user.upsert({
        where: { email: "pro@zenit.local" },
        update: {},
        create: { email: "pro@zenit.local", password: "pro123", role: "PROFESIONAL" }
    });

    const pacUser = await prisma.user.upsert({
        where: { email: "paciente@zenit.local" },
        update: {},
        create: { email: "paciente@zenit.local", password: "pac123", role: "PACIENTE" }
    });

    // Perfiles relacionados a los users
    const prof = await prisma.professionalProfile.upsert({
        where: { userId: proUser.id }, // userId es @unique
        update: {},
        create: {
            userId: proUser.id,
            nombre: "Ana",
            apellido: "García",
            especialidad: "Clínica",
            colorAgenda: "#4f46e5"
        }
    });

    await prisma.patientProfile.upsert({
        where: { userId: pacUser.id }, // userId es @unique
        update: {},
        create: {
            userId: pacUser.id,
            nombre: "Juan",
            apellido: "Pérez",
            telefono: "123456789"
        }
    });

    // Disponibilidad lun-vie 9 a 13 hs para la profesional, en Consultorio A
    for (const d of [1, 2, 3, 4, 5]) {
        const exists = await prisma.availability.findFirst({
            where: { professionalId: prof.id, dayOfWeek: d, startTime: "09:00", endTime: "13:00" }
        });
        if (!exists) {
            await prisma.availability.create({
                data: {
                    professionalId: prof.id,
                    dayOfWeek: d,
                    startTime: "09:00",
                    endTime: "13:00",
                    roomId: roomA.id
                }
            });
        }
    }

    console.log("Seed ok");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
