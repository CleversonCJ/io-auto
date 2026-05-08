import { SetPasswordPage } from "@/modules/auth/components/SetPasswordPage";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function resolveToken(searchParams: Record<string, string | string[] | undefined>) {
    const raw = searchParams.token;
    if (Array.isArray(raw)) {
        return raw[0] ?? "";
    }
    return raw ?? "";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
    const resolvedSearchParams = await searchParams;
    const token = resolveToken(resolvedSearchParams);

    return <SetPasswordPage token={token} />;
}
