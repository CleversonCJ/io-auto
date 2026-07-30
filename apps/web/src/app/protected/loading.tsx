import { SystemPageLoader } from "@/modules/shared/components/SystemPageLoader";

export default function ProtectedRouteLoading() {
    return <SystemPageLoader label="Carregando página" description="Organizando as informações para você..." />;
}
