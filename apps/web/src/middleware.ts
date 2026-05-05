import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ACCESS_COOKIE = "io_access";
const REFRESH_COOKIE = "io_refresh";
function isProtected(pathname: string) {
    return pathname.startsWith("/")
        && !pathname.startsWith("/login")
        && !pathname.startsWith("/api")
        && !pathname.startsWith("/estoque-publico");
}

function isAdminRoute(pathname: string) {
    return pathname.startsWith("/protected/admin");
}

function isSuperAdminRoute(pathname: string) {
    return pathname.startsWith("/protected/superadmin");
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (!isProtected(pathname)) return NextResponse.next();

    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    try {
        const secret = process.env.JWT_SECRET_FOR_MIDDLEWARE;
        if (!secret) {
            if (isAdminRoute(pathname)) {
                const url = req.nextUrl.clone();
                url.pathname = "/protected/dashboard";
                return NextResponse.redirect(url);
            }
            return NextResponse.next();
        }

        const key = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, key);

        const roles = (payload.roles as string[]) ?? [];

        if (isAdminRoute(pathname) && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
            const url = req.nextUrl.clone();
            url.pathname = "/protected/dashboard";
            return NextResponse.redirect(url);
        }

        if (isSuperAdminRoute(pathname) && !roles.includes("SUPERADMIN")) {
            const url = req.nextUrl.clone();
            url.pathname = "/protected/dashboard";
            return NextResponse.redirect(url);
        }

        return NextResponse.next();
    } catch (error) {
        console.error("[Middleware] JWT verification failed:", error);
        // Don't clear auth cookies during page navigation. The browser-facing
        // auth routes already know how to refresh or expire the session safely,
        // and being aggressive here can wipe a valid session during client
        // transitions in App Router.
        return NextResponse.next();
    }
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
