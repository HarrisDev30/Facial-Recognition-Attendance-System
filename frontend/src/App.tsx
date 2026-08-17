import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LoadingOverlay, Container, Title, Text, Button } from "@mantine/core";
import { useAuthStore } from "./store/authStore";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/layout/AdminLayout";
import MarshalLayout from "./components/layout/MarshalLayout";
import StudentLayout from "./components/layout/StudentLayout";
import ScannerLayout from "./components/scanner/ScannerLayout";
import StudentLoginPage from "./pages/StudentLoginPage";
import StudentSignUpPage from "./pages/StudentSignUpPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import StudentBiometricRegistration from "./pages/StudentBiometricRegistration";
import AttendanceHistoryPage from "./pages/AttendanceHistoryPage";
import UpcomingEventsPage from "./pages/UpcomingEventsPage";
import EventAttendanceDetailPage from "./pages/EventAttendanceDetailPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminEventsPage from "./pages/AdminEventsPage";
import AdminEventSessionsPage from "./pages/AdminEventSessionsPage";
import AdminAttendeesPage from "./pages/AdminAttendeesPage";
import AdminSessionAttendancePage from "./pages/AdminSessionAttendancePage";
import AdminEnrollmentPage from "./pages/AdminEnrollmentPage";
import ScannerDisplay from "./pages/ScannerDisplay";
import MobileScannerMode from "./pages/MobileScannerMode";
import DetectionZoneConfig from "./pages/DetectionZoneConfig";
import AdminScannerDevicesPage from "./pages/AdminScannerDevicesPage";
import MarshalDashboardPage from "./pages/MarshalDashboardPage";
import MarshalEventsPage from "./pages/MarshalEventsPage";
import MarshalEventDetailPage from "./pages/MarshalEventDetailPage";
import ScannerMultiFace from "./pages/ScannerMultiFace";
import QRCodeCheckInPage from "./pages/QRCodeCheckInPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import DataRemovalRequestPage from "./pages/DataRemovalRequestPage";
import { OrganizationsPage } from "./pages/admin/OrganizationsPage";
import { OrgMembersPage } from "./pages/admin/OrgMembersPage";
import { roleHome } from "./utils/routes";

function RootRedirect() {
  const { token, user, loading } = useAuthStore();
  const location = useLocation();

  if (loading || (token && !user)) {
    return <LoadingOverlay visible />;
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const home = roleHome(user!.role);
  if (home !== location.pathname) {
    return <Navigate to={home} replace />;
  }

  return (
    <Container py="xl" ta="center">
      <Title order={3}>Welcome</Title>
      <Text c="dimmed" my="md">
        No dashboard available for your role yet.
      </Text>
      <Button onClick={() => { useAuthStore.getState().logout(); }}>Sign out</Button>
    </Container>
  );
}

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <Routes>
      <Route path="/login" element={<StudentLoginPage />} />
      <Route path="/register" element={<StudentSignUpPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Student + Staff (shared attendee routes) */}
      <Route element={<ProtectedRoute roles={["student", "staff"]} />}>
        <Route path="/register-biometrics" element={<StudentBiometricRegistration />} />
        <Route element={<StudentLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/profile" element={<StudentProfilePage />} />
          <Route path="/student/attendance" element={<AttendanceHistoryPage />} />
          <Route path="/student/events" element={<UpcomingEventsPage />} />
          <Route path="/student/events/:eventId" element={<EventAttendanceDetailPage />} />
          <Route path="/privacy/data-removal" element={<DataRemovalRequestPage />} />
        </Route>
      </Route>

      {/* Shared Profile Route for all logged in roles */}
      <Route element={<ProtectedRoute roles={["admin", "org_admin", "marshal", "student", "staff"]} />}>
        <Route path="/profile" element={<StudentProfilePage />} />
      </Route>

      {/* Marshal */}
      <Route element={<ProtectedRoute roles={["marshal"]} />}>
        <Route element={<MarshalLayout />}>
          <Route path="/marshal/dashboard" element={<MarshalDashboardPage />} />
          <Route path="/marshal/events" element={<MarshalEventsPage />} />
          <Route path="/marshal/events/:eventId/sessions" element={<MarshalEventDetailPage />} />
          <Route path="/marshal/profile" element={<StudentProfilePage />} />
        </Route>
      </Route>

      {/* Admin & Org Admin */}
      <Route element={<ProtectedRoute roles={["admin", "org_admin"]} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/organizations" element={<OrganizationsPage />} />
          <Route path="/admin/organizations/:id" element={<OrgMembersPage />} />
          <Route path="/admin/events" element={<AdminEventsPage />} />
          <Route path="/admin/events/:eventId/sessions" element={<AdminEventSessionsPage />} />
          <Route path="/admin/attendees" element={<AdminAttendeesPage />} />
          <Route path="/admin/sessions/:sessionId/attendance" element={<AdminSessionAttendancePage />} />
          <Route path="/admin/enrollment" element={<AdminEnrollmentPage />} />
          <Route path="/admin/scanner-devices" element={<AdminScannerDevicesPage />} />
          <Route path="/admin/scanner-config/:deviceId" element={<DetectionZoneConfig />} />
          <Route path="/admin/profile" element={<StudentProfilePage />} />
          <Route index element={<AdminDashboardPage />} />
        </Route>
      </Route>

      {/* Scanner */}
      <Route element={<ProtectedRoute roles={["admin", "org_admin", "marshal"]} />}>
        <Route element={<ScannerLayout />}>
          <Route path="/scanner/:sessionId" element={<ScannerDisplay />} />
          <Route path="/scanner/qr-checkin/:sessionId" element={<QRCodeCheckInPage />} />
          <Route path="/scanner/mobile/:sessionId" element={<MobileScannerMode />} />
          <Route path="/scanner/multi-face/:sessionId" element={<ScannerMultiFace />} />
        </Route>
      </Route>

      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
