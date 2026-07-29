import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";
import type { PublicInventoryCatalog, PublicVehicleDetail } from "@/modules/ioauto/types";

type ApiError = {
    message?: string;
};

async function fetchPublicResource<T>(path: string) {
    const apiBase = getServerApiBase();
    const response = await fetchUpstream(`${apiBase}${path}`, { cache: "no-store" });
    const payload = await readJsonSafely<T | ApiError>(response);

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error((payload as ApiError | null)?.message ?? "Falha ao carregar o catálogo público.");
    }

    return payload as T;
}

export async function getPublicInventoryCatalog(companySlug: string) {
    return fetchPublicResource<PublicInventoryCatalog>(`/public/stock/${companySlug}`);
}

export async function getPublicVehicleDetail(companySlug: string, vehicleId: string) {
    return fetchPublicResource<PublicVehicleDetail>(`/public/stock/${companySlug}/vehicles/${vehicleId}`);
}
