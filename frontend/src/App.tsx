import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { LoadingOverlay } from "@mantine/core";
import { useAuthStore } from "./store/authStore";
import { InstitutionThemeProvider } from "./theme/InstitutionThemeProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/layout/AdminLayout";
import SuperAdminLayout from "./components/layout/SuperAdminLayout";
import MarshalLayout from "./components/layout/MarshalLayout";
import StudentLayout from "./components/layout/StudentLayout";
import ScannerLayout from "./components/scanner/ScannerLayout";
import MaintenanceBanner from "./components/shared/MaintenanceBanner";
// Public / Auth Pages
import LandingPage from "./pages/public/LandingPage";
import CampusPortalPage from "./pages/public/CampusPortalPage";
import LoginPage from "./pages/public/LoginPage";
import StudentSignUpPage from "./pages/public/StudentSignUpPage";
import PrivacyPolicyPage from "./pages/public/PrivacyPolicyPage";
import DataRemovalRequestPage from "./pages/public/DataRemovalRequestPage";

// Student Pages
import StudentProfilePage from "./pages/student/StudentProfilePage";
import StudentDashboardPage from "./pages/student/StudentDashboardPage";
import StudentBiometricRegistration from "./pages/student/StudentBiometricRegistration";
import AttendanceHistoryPage from "./pages/student/AttendanceHistoryPage";
import UpcomingEventsPage from "./pages/student/UpcomingEventsPage";
import EventAttendanceDetailPage from "./pages/student/EventAttendanceDetailPage";

// Marshal Pages
import MarshalDashboardPage from "./pages/marshal/MarshalDashboardPage";
import MarshalEventsPage from "./pages/marshal/MarshalEventsPage";
import MarshalEventDetailPage from "./pages/marshal/MarshalEventDetailPage";

// Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminEventsPage from "./pages/admin/AdminEventsPage";
import AdminEventSessionsPage from "./pages/admin/AdminEventSessionsPage";
import AdminAttendeesPage from "./pages/admin/AdminAttendeesPage";
import AdminSessionAttendancePage from "./pages/admin/AdminSessionAttendancePage";
import AdminEnrollmentPage from "./pages/admin/AdminEnrollmentPage";
import AdminScannerDevicesPage from "./pages/admin/AdminScannerDevicesPage";
import { OrganizationsPage } from "./pages/admin/OrganizationsPage";
import { OrgMembersPage } from "./pages/admin/OrgMembersPage";
import AdminStaffDirectoryPage from "./pages/admin/AdminStaffDirectoryPage";
import InstitutionSettingsPage from "./pages/admin/InstitutionSettingsPage";

// Super Admin Pages
import SuperAdminDashboardPage from "./pages/super-admin/SuperAdminDashboardPage";
import SuperAdminInstitutionsPage from "./pages/super-admin/SuperAdminInstitutionsPage";
import SuperAdminDevicesPage from "./pages/super-admin/SuperAdminDevicesPage";

// Scanner Pages
import ScannerDisplay from "./pages/scanner/ScannerDisplay";
import MobileScannerMode from "./pages/scanner/MobileScannerMode";
import DetectionZoneConfig from "./pages/scanner/DetectionZoneConfig";
import ScannerMultiFace from "./pages/scanner/ScannerMultiFace";
import QRCodeCheckInPage from "./pages/scanner/QRCodeCheckInPage";
import ScannerPairingPage from "./pages/scanner/ScannerPairingPage";
import { roleHome } from "./utils/routes";
import { getTenantSlugFromHostname, isReservedSlug } from "./utils/tenant";

function RootHandler() {
  const { token, user, loading } = useAuthStore();
  const location = useLocation();

  if (loading || (token && !user)) {
    return <LoadingOverlay visible />;
  }

  // If user is already authenticated, take them to their role home
  if (token && user) {
    const home = roleHome(user.role);
    if (home !== location.pathname) {
      return <Navigate to={home} replace />;
    }
  }

  // If on a campus subdomain (e.g. cjc.attendify.app or cjc.localhost), route to campus portal
  const tenantSlug = getTenantSlugFromHostname();
  if (tenantSlug) {
    return <Navigate to={`/${tenantSlug}`} replace />;
  }

  // Default: Show public Attendify Landing Page
  return <LandingPage />;
}

function CampusRouteWrapper() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || isReservedSlug(slug)) {
    return <Navigate to="/" replace />;
  }
  return <CampusPortalPage />;
}

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <InstitutionThemeProvider>
      <MaintenanceBanner />
      <Routes>
        <Route path="/" element={<RootHandler />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<StudentSignUpPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/scanner/pair" element={<ScannerPairingPage />} />

        {/* Super Admin Command Center */}
        <Route element={<ProtectedRoute roles={["super_admin"]} />}>
          <Route element={<SuperAdminLayout />}>
            <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
            <Route path="/super-admin/dashboard" element={<SuperAdminDashboardPage />} />
            <Route path="/super-admin/institutions" element={<SuperAdminInstitutionsPage />} />
            <Route path="/super-admin/devices" element={<SuperAdminDevicesPage />} />
            <Route path="/super-admin/profile" element={<StudentProfilePage />} />
          </Route>
        </Route>

        {/* Dedicated Immersive Biometric Setup Flow (Isolated without dashboard chrome) */}
        <Route element={<ProtectedRoute roles={["student", "staff"]} />}>
          <Route path="/register-biometrics" element={<StudentBiometricRegistration />} />
          <Route path="/student/register-biometrics" element={<StudentBiometricRegistration />} />
        </Route>

        {/* Student + Staff (standard dashboard chrome routes) */}
        <Route element={<ProtectedRoute roles={["student", "staff"]} />}>
          <Route element={<StudentLayout />}>
            <Route path="/student/dashboard" element={<StudentDashboardPage />} />
            <Route path="/student/attendance" element={<AttendanceHistoryPage />} />
            <Route path="/student/events" element={<UpcomingEventsPage />} />
            <Route path="/student/events/:eventId" element={<EventAttendanceDetailPage />} />
            <Route path="/student/profile" element={<StudentProfilePage />} />
            <Route path="/profile" element={<StudentProfilePage />} />
            <Route path="/privacy/data-removal" element={<DataRemovalRequestPage />} />
          </Route>
        </Route>

        {/* Marshal */}
        <Route element={<ProtectedRoute roles={["marshal"]} />}>
          <Route element={<MarshalLayout />}>
            <Route path="/marshal/dashboard" element={<MarshalDashboardPage />} />
            <Route path="/marshal/events" element={<MarshalEventsPage />} />
            <Route path="/marshal/events/:eventId/sessions" element={<MarshalEventDetailPage />} />
            <Route path="/marshal/profile" element={<StudentProfilePage />} />
            <Route path="/marshal/scanner/:sessionId" element={<ScannerDisplay />} />
            <Route path="/marshal/scanner/mobile/:sessionId" element={<MobileScannerMode />} />
            <Route path="/marshal/scanner/qr-checkin/:sessionId" element={<QRCodeCheckInPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute roles={["admin", "org_admin", "super_admin"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/organizations" element={<OrganizationsPage />} />
            <Route path="/admin/organizations/:orgId" element={<OrgMembersPage />} />
            <Route path="/admin/organizations/:orgId/members" element={<OrgMembersPage />} />
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/admin/events/:eventId/sessions" element={<AdminEventSessionsPage />} />
            <Route path="/admin/students" element={<AdminAttendeesPage />} />
            <Route path="/admin/staff" element={<AdminStaffDirectoryPage />} />
            <Route path="/admin/settings" element={<InstitutionSettingsPage />} />
            <Route path="/admin/enrollment" element={<AdminEnrollmentPage />} />
            <Route path="/admin/scanner-devices" element={<AdminScannerDevicesPage />} />
            <Route path="/admin/scanner-devices/:deviceId/zone" element={<DetectionZoneConfig />} />
            <Route path="/admin/sessions/:sessionId/attendance" element={<AdminSessionAttendancePage />} />
            <Route path="/admin/profile" element={<StudentProfilePage />} />
          </Route>
        </Route>

        {/* Scanner kiosk display */}
        <Route element={<ScannerLayout />}>
          <Route path="/scanner/:sessionId" element={<ScannerDisplay />} />
          <Route path="/scanner/mobile/:sessionId" element={<MobileScannerMode />} />
          <Route path="/scanner/multi/:sessionId" element={<ScannerMultiFace />} />
          <Route path="/scanner/qr-checkin/:sessionId" element={<QRCodeCheckInPage />} />
        </Route>

        {/* Dynamic Campus Portal & Locked Registration Routes (e.g. /cjc, /cjc/register) */}
        <Route path="/:slug/register" element={<StudentSignUpPage />} />
        <Route path="/:slug" element={<CampusRouteWrapper />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </InstitutionThemeProvider>
  );
}
