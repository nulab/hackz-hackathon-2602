import { createFileRoute } from "@tanstack/react-router";

const HomePage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen p-4">
    <h1 className="text-2xl font-bold text-gray-900">Idol Interactive Demo</h1>
    <p className="mt-2 text-gray-600">Mobile App</p>
  </div>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
