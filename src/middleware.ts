import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// 1. Define las rutas que queremos proteger
const protectedRoutes: Record<string, string[]> = {
    // Rutas de Recepción
    "/recepcion": ["ADMIN", "RECEPCION"],
    "/pagos": ["ADMIN", "RECEPCION"],

    // Ruta Profesional
    "/profesional": ["PROFESIONAL"],

    // --- INICIO: CAMBIO ---
    // Ruta Paciente
    "/paciente": ["PACIENTE"], // <-- Protegemos /paciente y todo lo que esté dentro
    // --- FIN: CAMBIO ---
};

// 2. Define las rutas públicas (donde NO se necesita sesión)
const publicRoutes = [
    "/login",
    "/register",
    "/api/auth/login",
    "/api/auth/crear-cuenta",
    "/api/auth/me",
    "/api/auth/logout",
];

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // --- Lógica de rutas públicas ---
    const isPublic = publicRoutes.some((p) => path.startsWith(p));
    const session = await getSession();

    if (isPublic) {
        if (session && !path.startsWith("/api")) {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return NextResponse.next();
    }

    // --- Lógica de rutas protegidas ---
    if (!session) {
        if (path === "/login") {
            return NextResponse.next();
        }
        console.log(`[Middleware] Usuario no autenticado intentando acceder a ${path}. Redirigiendo a /login.`);
        return NextResponse.redirect(new URL("/login", req.url));
    }

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
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    return NextResponse.next();
}

// 3. Configuración del Matcher
export const config = {
    matcher: [
        "/((?!api/health|_next/static|_next/image|favicon.ico|zenit-logo@2x.png).*)",
    ],
};