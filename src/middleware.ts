import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// 1. Define las rutas que queremos proteger
const protectedRoutes: Record<string, string[]> = {
    // Excepción: Permitir a profesionales ver perfiles de pacientes
    "/recepcion/perfil-paciente": ["ADMIN", "RECEPCION", "PROFESIONAL"],

    // Rutas de Recepción
    "/recepcion": ["ADMIN", "RECEPCION"],
    "/pagos": ["ADMIN", "RECEPCION"],

    // Ruta Profesional
    "/profesional": ["PROFESIONAL", "ADMIN"],

    // Ruta Paciente
    "/paciente": ["PACIENTE", "ADMIN"],

    // --- NUEVA RUTA PROTEGIDA ADMIN ---
    "/admin": ["ADMIN"],
};

// 2. Rutas públicas
const publicRoutes = [
    "/login",
    "/register",
    "/api/auth/login",
    "/api/auth/crear-cuenta",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/cambiar-password",
    "/api/admin/init", // <--- IMPORTANTE: Pública para que puedas crear tu usuario inicial
];

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // --- Lógica de rutas públicas ---
    const isPublic = publicRoutes.some((p) => path.startsWith(p));
    const session = await getSession();

    if (isPublic) {
        if (session && !path.startsWith("/api") && (path === "/login" || path === "/register")) {
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

    // El orden de las claves en protectedRoutes es crucial.
    const protectedRouteRule = Object.keys(protectedRoutes).find(
        (routePrefix) => path.startsWith(routePrefix)
    );

    // --- Lógica de cambio de password obligatorio ---
    if (session.mustChangePassword && path !== "/cambiar-password") {
        return NextResponse.redirect(new URL("/cambiar-password", req.url));
    }
    if (!session.mustChangePassword && path === "/cambiar-password") {
        return NextResponse.redirect(new URL("/", req.url));
    }

    if (protectedRouteRule) {
        const allowedRoles = protectedRoutes[protectedRouteRule];

        if (allowedRoles.includes(session.role)) {
            return NextResponse.next();
        } else {
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