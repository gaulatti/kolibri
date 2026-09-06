import {
  index,
  layout,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  route("sign-in", "routes/sign-in.tsx"),
  route("auth/callback", "routes/auth-callback.tsx"),
  layout("routes/protected-layout.tsx", [
    index("routes/home.tsx"),
    route("design-systems", "routes/design-systems-index.tsx"),
    route("design-systems/new", "routes/design-system-new.tsx"),
    route("design-systems/:designSystemId", "routes/design-system-detail.tsx"),
    route(
      "design-systems/:designSystemId/edit",
      "routes/design-system-edit.tsx",
    ),
    route("generations/new", "routes/generation-new.tsx"),
    route("generations/:generationId", "routes/generation-detail.tsx"),
    route(
      "design-systems/:designSystemId/history/report",
      "routes/generation-history-report.tsx",
    ),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
