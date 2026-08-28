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

  if (roles && user) {
    const isSuperOrAdmin = user.role === "super_admin" || user.role === "admin";
    const isMarshal =
      user.role === "marshal" ||
      user.is_marshal === true ||
      (user.marshal_org_ids && user.marshal_org_ids.length > 0);
    const isStudent = user.role === "student" || !!user.attendee_id;

    const hasAccess =
      roles.includes(user.role) ||
      (roles.includes("marshal") && (isMarshal || isSuperOrAdmin)) ||
      (roles.includes("student") && isStudent) ||
      (roles.includes("admin") && isSuperOrAdmin);

    if (!hasAccess) {
      const home = roleHome(user.role);
      if (home === location.pathname) {
        return <NotAuthorized />;
      }
      return <Navigate to={home} replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
