import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);
const COOKIE_NAME = "session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

export type SessionPayload = {
    userId: string;
    email: string;
    role: Role;
    nombre: string;
    mustChangePassword?: boolean;
};

export async function encrypt(payload: SessionPayload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(encodedKey);
}

export async function decrypt(session: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(session, encodedKey, {
            algorithms: ["HS256"],
        });
        return payload as SessionPayload;
    } catch (error) {
        console.error("Falló la verificación del JWT:", (error as Error).message);
        return null;
    }
}

/**
 * Crea la cookie de sesión en el navegador del usuario.
 */
export async function createSession(payload: SessionPayload) {
    const expires = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000);
    const session = await encrypt(payload);

    // --- CORRECCIÓN FINAL: Añadir 'await' ---
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        expires: expires,
        sameSite: "lax",
        path: "/",
    });
}

/**
 * Obtiene la sesión actual desde la cookie.
 */
export async function getSession(): Promise<SessionPayload | null> {
    // --- CORRECCIÓN FINAL: Añadir 'await' ---
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

    if (!sessionCookie) {
        return null; // No hay sesión
    }

    const payload = await decrypt(sessionCookie);

    if (!payload) {
        return null; // Sesión inválida o expirada
    }

    return payload;
}

/**
 * Cierra la sesión del usuario eliminando la cookie.
 */
export async function deleteSession() {
    // --- CORRECCIÓN FINAL: Añadir 'await' ---
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", {
        expires: new Date(0), // Expira inmediatamente
        path: "/",
    });
}