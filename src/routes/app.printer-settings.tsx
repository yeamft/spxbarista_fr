import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/printer-settings")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
