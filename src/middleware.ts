import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// 1. Define las rutas que queremos proteger
const protectedRoutes: Record<string, string[]> = {
    // Rutas de Recepción
    "/recepcion": ["ADMIN", "RECEPCION"],
    "/pagos": ["ADMIN", "RECEPCION"],

    // --- NUEVA RUTA PROFESIONAL ---
    "/profesional": ["PROFESIONAL"], // Protege /profesional y todo lo que esté dentro
};

// 2. Define las rutas públicas (donde NO se necesita sesión)
const publicRoutes = [
    "/login",
    "/register",
    "/api/auth/login",
    "/api/auth/crear-cuenta",
];

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // --- Lógica de rutas públicas ---
    const isPublic = publicRoutes.some((p) => path.startsWith(p));
    const session = await getSession();

    if (isPublic) {
        if (session) {
            // Si tiene sesión, lo mandamos a la raíz (que redirige a su panel)
            return NextResponse.redirect(new URL("/", req.url));
        }
        return NextResponse.next();
    }

    // --- Lógica de rutas protegidas ---
    if (!session) {
        console.log(`[Middleware] Usuario no autenticado intentando acceder a ${path}. Redirigiendo a /login.`);
        return NextResponse.redirect(new URL("/login", req.url));
    }

    // Encontrar la regla de protección que coincida con la ruta
    // (Ej. /profesional/agenda coincide con /profesional)
    const protectedRouteRule = Object.keys(protectedRoutes).find(
        (routePrefix) => path.startsWith(routePrefix)
    );

    if (protectedRouteRule) {
        const allowedRoles = protectedRoutes[protectedRouteRule];

        if (allowedRoles.includes(session.role)) {
            // ¡Permiso concedido! Déjalo pasar.
            return NextResponse.next();
        } else {
            // No tiene el rol correcto.
            console.warn(`[Middleware] Usuario ${session.email} (Rol: ${session.role}) sin permiso para ${path}.`);
            // Lo mandamos a la raíz (que lo redirigirá a su panel correcto)
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    // Si la ruta no es pública ni está protegida (ej. "/"), déjalo pasar.
    // (La ruta "/" luego redirigirá al panel correcto)
    return NextResponse.next();
}

// 3. Configuración del Matcher
export const config = {
    matcher: [
        "/((?!api/health|_next/static|_next/image|favicon.ico).*)",
    ],
};