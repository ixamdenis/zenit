// src/app/api/payments/mark-paid/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// DEBUG: si entrás con GET en el navegador, tenés que ver este JSON.
// Si acá ves 404, el problema es la ubicación/nombre del archivo.
export async function GET() {
    return NextResponse.json({ ok: true, route: "/api/payments/mark-paid" });
}

type Body = { paymentId: string; note?: string };

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Body;
        if (!body?.paymentId) {
            return NextResponse.json({ error: "Falta paymentId" }, { status: 400 });
        }

        const updated = await (prisma as any)["payment"].update({
            where: { id: body.paymentId },
            data: { status: "PAID", note: body.note ?? "Pago marcado manualmente" },
            include: { appointment: true },
        });

        return NextResponse.json({ ok: true, payment: updated });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
