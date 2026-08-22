import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { LoadingOverlay } from "@mantine/core";
import { roleHome } from "../utils/routes";
import NotAuthorized from "./shared/NotAuthorized";

interface Props {
  children?: React.ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { token, user, loading } = useAuthStore();
  const location = useLocation();

  if (loading || (token && !user)) {
    return <LoadingOverlay visible />;
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    const home = roleHome(user.role);
    if (home === location.pathname) {
      return <NotAuthorized />;
    }
    return <Navigate to={home} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
