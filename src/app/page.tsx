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
            // ¡Ahora redirige al panel de profesional!
            redirect("/profesional/agenda");

        case "PACIENTE":
            // Cuando creemos el panel de paciente, redirigirá a:
            // redirect("/paciente/turnos");
            // Por ahora, lo mandamos a recepción como fallback
            // (O podríamos mostrar una página de "En construcción")
            redirect("/recepcion");

        default:
            redirect("/login");
    }
}