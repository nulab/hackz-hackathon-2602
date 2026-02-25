import { createFileRoute } from "@tanstack/react-router";

const AdminPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-800">NFC Session Manager</h2>
    <p className="mt-2 text-gray-600">Scan NFC tags to start interactive sessions.</p>
  </div>
);

export const Route = createFileRoute("/")({
  component: AdminPage,
});
