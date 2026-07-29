import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/core/auth/cookies";
import { resolveProtectedHomePath } from "@/core/auth/redirects";

export default async function ProtectedIndexPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE)?.value ?? cookieStore.get(REFRESH_COOKIE)?.value;
    redirect(resolveProtectedHomePath(token));
}
