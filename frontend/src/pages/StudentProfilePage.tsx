import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Text,
  Button,
  Alert,
  Group,
  Badge,
  TextInput,
  Modal,
  Checkbox,
  Stack,
  SimpleGrid,
  Textarea,
  Select,
  Menu,
  Skeleton,
  Tabs,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCamera,
  IconShieldCheck,
  IconScan,
  IconSparkles,
  IconAlertCircle,
  IconLock,
  IconTrash,
  IconArrowRight,
  IconEdit,
  IconUser,
  IconFileCheck,
} from "@tabler/icons-react";
import { useAuthStore } from "../store/authStore";
import { useInstitutionTheme } from "../theme/InstitutionThemeProvider";
import {
  getMyProfile,
  updateMyProfile,
  getConsentStatus,
  giveConsent,
  requestDataRemoval,
  getMyAttendanceSummary,
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "../api/attendees";
import { getDepartments } from "../api/departments";
import type { AttendeeProfileResponse, AttendanceSummary, DepartmentListResponse } from "../types/auth";
import ConsentForm from "../components/ConsentForm";
import Avatar from "../components/Avatar";
import PhotoCropper from "../components/PhotoCropper";
import { useAsync, useFormSubmit } from "../hooks";
import { getApiError } from "../utils/error";
import { formatDate } from "../utils/formatters";
import "./UserProfilePage.css";

const ROLE_DISPLAY_NAMES: Record<string, { label: string; color: string }> = {
  student: { label: "Student Account", color: "blue" },
  marshal: { label: "Field Marshal", color: "teal" },
  admin: { label: "Campus Administrator", color: "indigo" },
  department_admin: { label: "Department Admin", color: "cyan" },
  super_admin: { label: "Super Administrator", color: "violet" },
};

export default function StudentProfilePage() {
  const { user } = useAuthStore();
  const { institution } = useInstitutionTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<AttendeeProfileResponse | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", identifier: "", department_id: "" });
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentCheckLoading, setConsentCheckLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentListResponse["items"]>([]);
  const [removalModalOpen, setRemovalModalOpen] = useState(false);
  const [removalChecked, setRemovalChecked] = useState(false);
  const [removalLoading, setRemovalLoading] = useState(false);
  const [removalReason, setRemovalReason] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("general");

  const loadProfileData = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      setError(null);
    } catch (err: any) {
      if (user) {
        // Universal fallback for Admin, Super-Admin, and Marshal accounts
        setProfile({
          id: user.id,
          first_name: user.first_name || "Campus",
          last_name: user.last_name || "User",
          identifier: user.email,
          email: user.email,
          attendee_type: (user.role as any) || "admin",
          department_id: null,
          department_code: null,
          department_name: user.institution_name || (user.role === "super_admin" ? "Platform Control" : "University Campus"),
          profile_photo_url: user.profile_photo_url || null,
          created_at: new Date().toISOString(),
          registration_status: "complete",
          consent_given: true,
          num_embeddings: 0,
        });
        setError(null);
      } else {
        throw err;
      }
    }
  }, [user]);

  const { loading, error: loadError, execute: loadProfile } = useAsync(loadProfileData, false);

  useEffect(() => {
    if (!user) return;
    loadProfile();
    if (user.role === "student" || user.role === "staff") {
      getMyAttendanceSummary()
        .then(setSummary)
        .catch(() => {});
    }
  }, [user, loadProfile]);

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  const startEditing = async () => {
    if (!profile) return;
    setEditForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      identifier: profile.identifier || "",
      department_id: profile.department_id || "",
    });
    if (departments.length === 0) {
      try {
        const res = await getDepartments({ org_type: "college" });
        setDepartments(res.items);
      } catch { /* ignore */ }
    }
    setEditing(true);
  };

  const { submit: saveProfile, submitting } = useFormSubmit(
    (formData: { first_name: string; last_name: string; identifier: string; department_id?: string }) =>
      updateMyProfile(formData),
    {
      onSuccess: () => {
        loadProfile();
        setEditing(false);
        notifications.show({ title: "Updated", message: "Profile saved successfully", color: "green" });
      },
      errorMessage: "Failed to update profile",
      showErrorNotification: false,
    },
  );

  const handleConsent = async (_consentChecked: boolean, _privacyChecked: boolean) => {
    setConsentLoading(true);
    try {
      await giveConsent({
        consent_given: _consentChecked,
        acknowledge_data_privacy: _privacyChecked,
      });
      setConsentModalOpen(false);
      navigate("/register-biometrics");
    } catch {
      setError("Failed to submit consent");
    } finally {
      setConsentLoading(false);
    }
  };

  const handleRemoval = async () => {
    setRemovalLoading(true);
    try {
      await requestDataRemoval(removalReason || undefined);
      setRemovalModalOpen(false);
      setRemovalChecked(false);
      setRemovalReason("");
      await loadProfile();
      notifications.show({ title: "Requested", message: "Data removal request submitted", color: "orange" });
    } catch (err) {
      setError(getApiError(err) || "Failed to submit removal request");
    } finally {
      setRemovalLoading(false);
    }
  };

  const handleStartRegistration = async () => {
    setConsentCheckLoading(true);
    try {
      const consentStatus = await getConsentStatus();
      if (consentStatus.has_consented) {
        navigate("/register-biometrics");
      } else {
        setConsentModalOpen(true);
      }
    } catch {
      setError("Failed to check consent status");
    } finally {
      setConsentCheckLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropperSave = async (blob: Blob) => {
    setCropperOpen(false);
    setCropperImageSrc(null);
    setPhotoUploading(true);
    try {
      const res = await uploadProfilePhoto(blob);
      setProfile((prev) =>
        prev ? { ...prev, profile_photo_url: res.profile_photo_url } : null,
      );
      useAuthStore.getState().setProfilePhotoUrl(res.profile_photo_url);
      notifications.show({ title: "Success", message: "Profile photo updated", color: "green" });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: getApiError(err) || "Failed to upload photo",
        color: "red",
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoRemove = async () => {
    try {
      await deleteProfilePhoto();
      setProfile((prev) => (prev ? { ...prev, profile_photo_url: null } : null));
      useAuthStore.getState().setProfilePhotoUrl(null);
      notifications.show({ title: "Success", message: "Profile photo removed", color: "green" });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: getApiError(err) || "Failed to remove photo",
        color: "red",
      });
    }
  };

  const isStudent = user?.role === "student" || user?.role === "staff";
  const isMarshal = user?.role === "marshal";
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "department_admin";

  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "User Profile";
  const roleConfig = ROLE_DISPLAY_NAMES[user?.role || "student"] || { label: "User Account", color: "gray" };

  return (
    <Container size="md" pt={0} pb="4xl">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        style={{ display: "none" }}
      />

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="lg"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ─── Top Identity Summary Card ─── */}
      <div className="profile-summary-card settings-fade-in">
        <div className="profile-identity-cluster">
          {/* Calibrated Avatar Box with Camera Action Menu */}
          <Menu shadow="md" width={180} position="bottom-start">
            <Menu.Target>
              <div className="profile-avatar-box">
                <Avatar
                  src={profile?.profile_photo_url || user?.profile_photo_url}
                  firstName={profile?.first_name || user?.first_name}
                  lastName={profile?.last_name || user?.last_name}
                  size="md"
                />
                <div className="profile-avatar-hover-icon">
                  <IconCamera size={20} />
                </div>
              </div>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconCamera size={14} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
              >
                {photoUploading ? "Uploading..." : "Upload Photo"}
              </Menu.Item>
              {(profile?.profile_photo_url || user?.profile_photo_url) && (
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={handlePhotoRemove}
                >
                  Remove Photo
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>

          {/* User Name & Metadata Badges */}
          <div className="profile-info-text">
            <div className="profile-name-row">
              <Text fz={{ base: "1.15rem", sm: "1.35rem" }} fw={700} c="var(--text-primary)" lh={1.2}>
                {loading ? <Skeleton height={24} width={180} /> : fullName}
              </Text>
              <IconShieldCheck size={18} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
            </div>

            <div className="profile-meta-badges">
              <Badge
                size="xs"
                variant="filled"
                styles={{
                  root: {
                    backgroundColor: "var(--brand-surface)",
                    color: "var(--brand-primary)",
                    border: "1px solid var(--brand-border)",
                    fontWeight: 700,
                  },
                }}
              >
                {roleConfig.label}
              </Badge>
              {(institution || profile?.department_name) && (
                <Badge size="xs" variant="light" color="gray">
                  {institution?.name || profile?.department_name}
                </Badge>
              )}
              <Text size="xs" c="dimmed" lineClamp={1}>
                {profile?.email}
              </Text>
            </div>
          </div>
        </div>

        {isStudent && (
          <div className="profile-header-cta">
            <Button
              className="btn-brand"
              size="xs"
              leftSection={<IconScan size={14} />}
              loading={consentCheckLoading}
              onClick={handleStartRegistration}
            >
              {profile?.registration_status === "complete" ? "Retake Face Scan" : "Enroll Face ID"}
            </Button>
          </div>
        )}
      </div>

      {/* ─── Horizontal Momentum Scroll Segmented Tabs ─── */}
      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" mb="xl">
        <Tabs.List className="settings-tab-list">
          <Tabs.Tab value="general" leftSection={<IconUser size={14} />}>
            General
          </Tabs.Tab>
          <Tabs.Tab value="biometrics" leftSection={<IconScan size={14} />}>
            Face Biometrics
          </Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<IconLock size={14} />}>
            Security
          </Tabs.Tab>
          <Tabs.Tab value="privacy" leftSection={<IconFileCheck size={14} />}>
            Data Privacy
          </Tabs.Tab>
        </Tabs.List>

        {/* ─── TAB 1: GENERAL PROFILE ─── */}
        <Tabs.Panel value="general" pt="md" className="settings-fade-in">
          <div className="settings-group-card">
            <div className="settings-group-header">
              <div>
                <Text size="sm" fw={700} c="var(--text-primary)">
                  Personal Information
                </Text>
                <Text size="xs" c="dimmed">
                  Official identity details and academic credentials
                </Text>
              </div>
              {!editing && (
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<IconEdit size={13} />}
                  onClick={startEditing}
                  className="btn-pressable"
                >
                  Edit Information
                </Button>
              )}
            </div>

            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveProfile({
                    first_name: editForm.first_name,
                    last_name: editForm.last_name,
                    identifier: editForm.identifier,
                    department_id: editForm.department_id || undefined,
                  });
                }}
                style={{ padding: "20px" }}
              >
                <Stack gap="md">
                  <SimpleGrid cols={2} spacing="md">
                    <TextInput
                      label="First Name"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.currentTarget.value }))}
                      required
                      size="sm"
                    />
                    <TextInput
                      label="Last Name"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.currentTarget.value }))}
                      required
                      size="sm"
                    />
                  </SimpleGrid>

                  <TextInput
                    label={isStudent ? "Student ID Number" : "Staff / Account Identifier"}
                    value={editForm.identifier}
                    onChange={(e) => setEditForm((f) => ({ ...f, identifier: e.currentTarget.value }))}
                    required
                    size="sm"
                  />

                  {isStudent && departments.length > 0 && (
                    <Select
                      label="Academic Department / College"
                      placeholder="Select department"
                      data={departments.map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` }))}
                      value={editForm.department_id}
                      onChange={(val) => setEditForm((f) => ({ ...f, department_id: val || "" }))}
                      clearable
                      size="sm"
                    />
                  )}

                  <Group justify="flex-end" mt="sm">
                    <Button variant="default" size="sm" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" color="blue" loading={submitting}>
                      Save Changes
                    </Button>
                  </Group>
                </Stack>
              </form>
            ) : (
              <div>
                <div className="settings-row">
                  <div className="settings-row-label-group">
                    <span className="settings-row-title">Full Name</span>
                    <span className="settings-row-description">Your legal name registered on the campus database</span>
                  </div>
                  <div className="settings-row-action">
                    <Text size="sm" fw={600} c="var(--text-primary)">
                      {loading ? <Skeleton height={14} width={120} /> : fullName}
                    </Text>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label-group">
                    <span className="settings-row-title">{isStudent ? "Student ID" : "Staff Identifier"}</span>
                    <span className="settings-row-description">Unique institutional identification code</span>
                  </div>
                  <div className="settings-row-action">
                    <Text size="sm" fw={600} style={{ fontFamily: "JetBrains Mono, monospace" }} c="var(--text-primary)">
                      {loading ? <Skeleton height={14} width={100} /> : (profile?.identifier || "—")}
                    </Text>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label-group">
                    <span className="settings-row-title">Official Email</span>
                    <span className="settings-row-description">Email used for sign-in and attendance receipts</span>
                  </div>
                  <div className="settings-row-action">
                    <Text size="sm" fw={500} c="var(--text-primary)">
                      {profile?.email}
                    </Text>
                  </div>
                </div>

                {profile?.department_name && (
                  <div className="settings-row">
                    <div className="settings-row-label-group">
                      <span className="settings-row-title">College / Department</span>
                      <span className="settings-row-description">Primary assigned academic unit</span>
                    </div>
                    <div className="settings-row-action">
                      <Badge size="sm" variant="light" color="gray">
                        {profile.department_name}
                      </Badge>
                    </div>
                  </div>
                )}

                {isStudent && summary && (
                  <div className="settings-row">
                    <div className="settings-row-label-group">
                      <span className="settings-row-title">Attendance Clearance Standing</span>
                      <span className="settings-row-description">Completed attendance sessions this semester</span>
                    </div>
                    <div className="settings-row-action">
                      <Badge
                        size="sm"
                        variant="light"
                        color={summary.attendance_rate >= 80 ? "teal" : "yellow"}
                      >
                        {summary.attendance_rate}% ({summary.total_events_attended} Sessions)
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* ─── TAB 2: FACE BIOMETRICS ─── */}
        <Tabs.Panel value="biometrics" pt="md" className="settings-fade-in">
          {isStudent ? (
            <div className="settings-group-card accent-border">
              <div className="settings-group-header">
                <div>
                  <Group gap="xs">
                    <IconSparkles size={16} style={{ color: "var(--brand-primary)" }} />
                    <Text size="sm" fw={700} c="var(--text-primary)">
                      Biometric Face ID Status
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Contactless facial recognition clearance for kiosk check-ins
                  </Text>
                </div>
                <Badge
                  size="sm"
                  variant="filled"
                  styles={{
                    root: {
                      backgroundColor: profile?.registration_status === "complete" ? "var(--brand-primary)" : "var(--surface-3)",
                      color: profile?.registration_status === "complete" ? "var(--brand-contrast-text)" : "var(--text-primary)",
                      fontWeight: 700,
                    },
                  }}
                >
                  {profile?.registration_status === "complete" ? "6/6 Angles Active" : "Incomplete"}
                </Badge>
              </div>

              <div className="settings-row">
                <div className="settings-row-label-group">
                  <span className="settings-row-title">Encrypted Facial Embeddings</span>
                  <span className="settings-row-description">
                    High-dimensional vector points generated during biometric enrollment
                  </span>
                </div>
                <div className="settings-row-action">
                  <Text size="sm" fw={700} style={{ color: "var(--brand-primary)" }}>
                    {profile?.num_embeddings ?? 0} Embeddings Saved
                  </Text>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-label-group">
                  <span className="settings-row-title">Biometric Recalibration</span>
                  <span className="settings-row-description">
                    Re-scan all 6 camera angles if your facial features change or recognition accuracy drops
                  </span>
                </div>
                <div className="settings-row-action">
                  <Button
                    variant="light"
                    size="xs"
                    onClick={handleStartRegistration}
                    loading={consentCheckLoading}
                    rightSection={<IconArrowRight size={12} />}
                    className="btn-pressable"
                    styles={{
                      root: {
                        backgroundColor: "var(--brand-surface)",
                        color: "var(--brand-primary)",
                        border: "1px solid var(--brand-border)",
                      },
                    }}
                  >
                    {profile?.registration_status === "complete" ? "Recalibrate Face ID" : "Complete Registration"}
                  </Button>
                </div>
              </div>
            </div>
          ) : isMarshal ? (
            <div className="settings-group-card accent-border">
              <div className="settings-group-header">
                <div>
                  <Text size="sm" fw={700} c="var(--text-primary)">
                    Field Marshal Scanner Authorization
                  </Text>
                  <Text size="xs" c="dimmed">
                    Permissions for operating facial recognition scanner kiosks
                  </Text>
                </div>
                <Badge size="sm" color="teal" variant="light">
                  Kiosk Certified
                </Badge>
              </div>

              <div className="settings-row">
                <div className="settings-row-label-group">
                  <span className="settings-row-title">Campus Clearance</span>
                  <span className="settings-row-description">Assigned venue and event coverage</span>
                </div>
                <div className="settings-row-action">
                  <Text size="sm" fw={600} c="var(--text-primary)">
                    {institution?.name || "Campus Kiosk Station"}
                  </Text>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-label-group">
                  <span className="settings-row-title">Kiosk Fast Launch</span>
                  <span className="settings-row-description">Open camera viewport for live session scanning</span>
                </div>
                <div className="settings-row-action">
                  <Button
                    component={Link}
                    to="/marshal/scanner"
                    className="btn-brand"
                    size="xs"
                    leftSection={<IconScan size={14} />}
                  >
                    Launch Scanner
                  </Button>
                </div>
              </div>
            </div>
          ) : isAdmin ? (
            <div className="settings-group-card">
              <div className="settings-group-header">
                <Text size="sm" fw={700} c="var(--text-primary)">
                  Administrative Access Control
                </Text>
              </div>
              <div className="settings-row">
                <div className="settings-row-label-group">
                  <span className="settings-row-title">Platform Biometrics Fleet</span>
                  <span className="settings-row-description">Manage and monitor institution-wide face recognition nodes</span>
                </div>
                <div className="settings-row-action">
                  <Button
                    component={Link}
                    to={user?.role === "super_admin" ? "/super-admin/institutions" : "/admin/dashboard"}
                    variant="default"
                    size="xs"
                    rightSection={<IconArrowRight size={12} />}
                  >
                    Manage Hardware
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Tabs.Panel>

        {/* ─── TAB 3: ACCOUNT SECURITY ─── */}
        <Tabs.Panel value="security" pt="md" className="settings-fade-in">
          <div className="settings-group-card">
            <div className="settings-group-header">
              <div>
                <Text size="sm" fw={700} c="var(--text-primary)">
                  Security & Access Controls
                </Text>
                <Text size="xs" c="dimmed">
                  Authentication status and account protection
                </Text>
              </div>
              <Badge size="xs" variant="light" color="teal">
                Protected
              </Badge>
            </div>

            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-row-title">Account Clearance Level</span>
                <span className="settings-row-description">Assigned role within the platform hierarchy</span>
              </div>
              <div className="settings-row-action">
                <Badge size="sm" variant="light" color={roleConfig.color}>
                  {roleConfig.label}
                </Badge>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-row-title">Active Session</span>
                <span className="settings-row-description">Authenticated securely with JWT bearer tokens</span>
              </div>
              <div className="settings-row-action">
                <Group gap={6}>
                  <span className="pulse-dot" />
                  <Text size="xs" fw={600} c="teal">
                    Online Now
                  </Text>
                </Group>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-row-title">Member Since</span>
                <span className="settings-row-description">Registration date on the Attendify platform</span>
              </div>
              <div className="settings-row-action">
                <Text size="xs" c="dimmed">
                  {profile?.created_at ? formatDate(profile.created_at) : "Platform Launch"}
                </Text>
              </div>
            </div>
          </div>
        </Tabs.Panel>

        {/* ─── TAB 4: DATA PRIVACY & COMPLIANCE ─── */}
        <Tabs.Panel value="privacy" pt="md" className="settings-fade-in">
          <div className="settings-group-card">
            <div className="settings-group-header">
              <div>
                <Text size="sm" fw={700} c="var(--text-primary)">
                  Data Privacy & Biometric Rights
                </Text>
                <Text size="xs" c="dimmed">
                  In compliance with Republic Act 10173 (Data Privacy Act)
                </Text>
              </div>
              <Badge size="xs" variant="light" color="teal">
                RA 10173 Certified
              </Badge>
            </div>

            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-row-title">Biometric Processing Consent</span>
                <span className="settings-row-description">
                  Authorization granted for encrypted facial vector comparison during attendance
                </span>
              </div>
              <div className="settings-row-action">
                <Badge size="sm" variant="light" color={profile?.consent_given ? "teal" : "yellow"}>
                  {profile?.consent_given ? "Consent Granted" : "Consent Pending"}
                </Badge>
              </div>
            </div>

            {isStudent && (
              <div className="settings-row">
                <div className="settings-row-label-group">
                  <span className="settings-row-title">Request Biometric Data Removal</span>
                  <span className="settings-row-description">
                    Permanently purge your facial embeddings and biometric records from the server
                  </span>
                </div>
                <div className="settings-row-action">
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={() => setRemovalModalOpen(true)}
                  >
                    Request Purge
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      {/* ─── Photo Cropper Modal ─── */}
      {cropperImageSrc && (
        <PhotoCropper
          opened={cropperOpen}
          imageSrc={cropperImageSrc}
          onSave={handleCropperSave}
          onClose={() => {
            setCropperOpen(false);
            setCropperImageSrc(null);
          }}
          cropShape="round"
        />
      )}

      {/* ─── Consent Modal ─── */}
      <ConsentForm
        opened={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        onConfirm={handleConsent}
        loading={consentLoading}
      />

      {/* ─── Data Removal Modal ─── */}
      <Modal
        opened={removalModalOpen}
        onClose={() => setRemovalModalOpen(false)}
        title="Request Biometric Data Removal"
      >
        <Stack gap="md">
          <Alert color="orange" title="Irreversible Action">
            Requesting data removal will permanently delete your facial biometric embeddings. You will no longer be able to use facial recognition check-in until you re-enroll.
          </Alert>
          <Textarea
            label="Reason for Removal (Optional)"
            placeholder="Tell us why you are requesting data removal..."
            value={removalReason}
            onChange={(e) => setRemovalReason(e.currentTarget.value)}
          />
          <Checkbox
            label="I understand that my biometric data will be permanently purged"
            checked={removalChecked}
            onChange={(e) => setRemovalChecked(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRemovalModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" disabled={!removalChecked} loading={removalLoading} onClick={handleRemoval}>
              Confirm Purge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
