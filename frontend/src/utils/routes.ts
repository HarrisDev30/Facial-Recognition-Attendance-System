export function roleHome(role: string): string {
  if (role === "super_admin") return "/super-admin/dashboard";
  if (role === "student") return "/student/dashboard";
  if (role === "staff") return "/student/dashboard";
  if (role === "admin" || role === "org_admin") return "/admin/dashboard";
  if (role === "marshal") return "/marshal/dashboard";
  return "/login";
}
