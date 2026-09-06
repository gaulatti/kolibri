import { Navigate, useSearchParams } from "react-router";
import type { Route } from "./+types/generation-new";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Generate package | kolibri" }];
}

export default function NewGenerationRedirect() {
  const [searchParams] = useSearchParams();
  const designSystemId = searchParams.get("designSystemId");
  return (
    <Navigate
      replace
      to={
        designSystemId
          ? `/design-systems/${encodeURIComponent(designSystemId)}?tab=generate`
          : "/design-systems"
      }
    />
  );
}
