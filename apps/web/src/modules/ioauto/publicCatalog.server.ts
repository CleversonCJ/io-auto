import { getServerApiBase } from "@/core/http/getServerApiBase";
import { fetchUpstream, readJsonSafely } from "@/core/http/upstream";
import type { PublicInventoryCatalog, PublicVehicleDetail } from "@/modules/ioauto/types";

type ApiError = {
    message?: string;
};

type PublicCatalogTracking = {
    sourceType?: string | null;
    sourceReference?: string | null;
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

function withTrackingQuery(path: string, tracking?: PublicCatalogTracking) {
    const sourceReference = tracking?.sourceReference?.trim();
    if (!sourceReference) return path;

    const query = new URLSearchParams();
    query.set("source", tracking?.sourceType?.trim() || "influencer");
    query.set("ref", sourceReference);
    return `${path}?${query.toString()}`;
}

export async function getPublicInventoryCatalog(companySlug: string, tracking?: PublicCatalogTracking) {
    return fetchPublicResource<PublicInventoryCatalog>(
        withTrackingQuery(`/public/stock/${companySlug}`, tracking)
    );
}

export async function getPublicVehicleDetail(companySlug: string, vehicleId: string, tracking?: PublicCatalogTracking) {
    return fetchPublicResource<PublicVehicleDetail>(
        withTrackingQuery(`/public/stock/${companySlug}/vehicles/${vehicleId}`, tracking)
    );
}
