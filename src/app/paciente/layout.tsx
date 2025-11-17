// src/app/paciente/layout.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";

export default async function PacienteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    // Verificamos que haya sesión Y que el rol sea PACIENTE
    // Si no, lo sacamos.
    if (!session || session.role !== Role.PACIENTE) {
        redirect("/login");
    }

    // Si es Paciente, mostramos la página que corresponda (children)
    return <>{children}</>;
}