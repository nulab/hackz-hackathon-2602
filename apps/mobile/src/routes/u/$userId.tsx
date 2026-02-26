import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { LoadingScreen } from "../../components/LoadingScreen";

const API_URL = import.meta.env.VITE_API_URL || "/trpc";

const searchSchema = z.object({
  token: z.string().optional(),
});

const verifyAuth = async (userId: string): Promise<void> => {
  const userToken = localStorage.getItem("userToken");
  if (!userToken) {
    throw notFound();
  }

  const res = await fetch(`${API_URL}/users.me`, {
    headers: {
      "X-User-Id": userId,
      "X-User-Token": userToken,
    },
  });

  if (!res.ok) {
    throw notFound();
  }
};

const UserLayout = () => <Outlet />;

export const Route = createFileRoute("/u/$userId")({
  validateSearch: searchSchema,
  beforeLoad: async ({ params, search }) => {
    // URL の ?token= パラメータを localStorage に保存
    if (search.token) {
      localStorage.setItem("userToken", search.token);
    }
    localStorage.setItem("userId", params.userId);

    await verifyAuth(params.userId);
  },
  pendingComponent: LoadingScreen,
  component: UserLayout,
});
