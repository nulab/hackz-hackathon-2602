import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().optional(),
});

const UserLayout = () => {
  const { userId } = Route.useParams();
  const { token } = Route.useSearch();

  if (token) {
    localStorage.setItem("userToken", token);
  }
  localStorage.setItem("userId", userId);

  return <Outlet />;
};

export const Route = createFileRoute("/u/$userId")({
  validateSearch: searchSchema,
  component: UserLayout,
});
