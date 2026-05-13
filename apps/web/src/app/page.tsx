import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE } from "@/core/auth/cookies";
import { resolveProtectedHomePath } from "@/core/auth/redirects";

export default async function HomePage() {
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) redirect(resolveProtectedHomePath(token));
    redirect("/login");
}
