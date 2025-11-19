export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function GET() {
    try {
        // Datos de tu super admin
        const email = "admin@zenit.local";
        const password = "admin123456"; // Puedes cambiar esto luego en la UI de perfil

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                role: Role.ADMIN, // Asegurar rol
                // password: hashedPassword // Descomentar si quieres resetear la pass
            },
            create: {
                email,
                password: hashedPassword,
                role: Role.ADMIN,
                mustChangePassword: false
            }
        });

        return NextResponse.json({
            msg: "Super Admin listo",
            email: user.email,
            role: user.role,
            info: "Si ya existía, se aseguró el rol. Si no, se creó con pass: admin123456"
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}