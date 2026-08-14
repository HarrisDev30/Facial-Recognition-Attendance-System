export function roleHome(role: string): string {
  if (role === "student") return "/student/dashboard";
  if (role === "staff") return "/student/dashboard";
  if (role === "admin" || role === "org_admin") return "/admin";
  if (role === "marshal") return "/marshal/dashboard";
  return "/login";
}
