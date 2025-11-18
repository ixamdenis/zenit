import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const protectedRoutes: Record<string, string[]> = {
    "/recepcion": ["ADMIN", "RECEPCION"],
    "/pagos": ["ADMIN", "RECEPCION"],
    "/profesional": ["PROFESIONAL"],
    "/paciente": ["PACIENTE"],
};

const publicRoutes = [
    "/login",
    "/register",
    "/api/auth/login",
    "/api/auth/crear-cuenta",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/cambiar-password"
];

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const isPublic = publicRoutes.some((p) => path.startsWith(p));
    const session = await getSession();

    if (isPublic) {
        if (session && !path.startsWith("/api") && (path === "/login" || path === "/register")) {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return NextResponse.next();
    }

    if (!session) {
        if (path === "/login") return NextResponse.next();
        return NextResponse.redirect(new URL("/login", req.url));
    }

    // Lógica: Redirigir a cambiar-password si es obligatorio
    if (session.mustChangePassword && path !== "/cambiar-password") {
        return NextResponse.redirect(new URL("/cambiar-password", req.url));
    }

    if (!session.mustChangePassword && path === "/cambiar-password") {
        return NextResponse.redirect(new URL("/", req.url));
    }

    // Lógica: Restricción por Rol
    const protectedRouteRule = Object.keys(protectedRoutes).find(
        (routePrefix) => path.startsWith(routePrefix)
    );

    if (protectedRouteRule) {
        const allowedRoles = protectedRoutes[protectedRouteRule];
        if (allowedRoles.includes(session.role)) {
            return NextResponse.next();
        } else {
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api/health|_next/static|_next/image|favicon.ico|zenit-logo@2x.png).*)",
    ],
};