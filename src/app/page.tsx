// src/app/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    // --- REDIRECCIÓN POR ROL (ACTUALIZADA) ---
    switch (session.role) {
        case "ADMIN":
        case "RECEPCION":
            redirect("/recepcion");

        case "PROFESIONAL":
            redirect("/profesional");

        // --- INICIO: CAMBIO ---
        case "PACIENTE":
            redirect("/paciente"); // <-- Redirige al nuevo panel de paciente
        // --- FIN: CAMBIO ---

        default:
            redirect("/login");
    }
}