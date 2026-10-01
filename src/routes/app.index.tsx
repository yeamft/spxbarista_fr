import { createFileRoute } from "@tanstack/react-router";
import { CoffeeServiceDashboard } from "@/components/dashboard/coffee-service-dashboard";

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  return <CoffeeServiceDashboard />;
}
