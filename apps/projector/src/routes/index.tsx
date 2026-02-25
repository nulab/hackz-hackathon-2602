import { createFileRoute } from "@tanstack/react-router";

const ProjectorPage = () => (
  <div className="flex flex-col items-center justify-center h-screen">
    <h1 className="text-4xl font-bold">Idol Interactive Demo</h1>
    <p className="mt-4 text-xl text-gray-400">Projector Display</p>
  </div>
);

export const Route = createFileRoute("/")({
  component: ProjectorPage,
});
