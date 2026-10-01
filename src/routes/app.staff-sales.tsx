import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/staff-sales")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
