import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/stock-management")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
