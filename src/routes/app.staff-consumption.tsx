import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/staff-consumption")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
