import { createFileRoute } from "@tanstack/react-router";
import { FlyerApp } from "@/components/flyer-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FlyerApp />;
}
