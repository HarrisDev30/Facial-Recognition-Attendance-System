import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { roleHome as getRoleHome } from "../utils/routes";

export function useRoleRedirect() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const roleHome = useCallback(
    (role?: string): string => getRoleHome(role ?? user?.role ?? ""),
    [user?.role],
  );

  const redirectToHome = useCallback(() => {
    const home = roleHome();
    navigate(home, { replace: true });
  }, [roleHome, navigate]);

  const isAdmin = user?.role === "admin";
  const isMarshal = user?.role === "marshal";
  const isStudent = user?.role === "student";

  return { roleHome, redirectToHome, isAdmin, isMarshal, isStudent };
}
