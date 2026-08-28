import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Button,
  Alert,
  TextInput,
  Modal,
  Checkbox,
  Stack,
  Textarea,
  Select,
  Skeleton,
  Menu,
  Group,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCamera,
  IconCheck,
  IconScan,
  IconAlertCircle,
  IconAlertTriangle,
  IconTrash,
  IconChevronRight,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import { useInstitutionTheme } from "../../theme/InstitutionThemeProvider";
import {
  getMyProfile,
  updateMyProfile,
  getConsentStatus,
  giveConsent,
  requestDataRemoval,
  getMyAttendanceSummary,
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "../../api/attendees";
import { getDepartments } from "../../api/departments";
import type { AttendeeProfileResponse, AttendanceSummary, DepartmentListResponse } from "../../types/auth";
import ConsentForm from "../../components/ConsentForm";
import Avatar from "../../components/Avatar";
import PhotoCropper from "../../components/PhotoCropper";
import { useAsync, useFormSubmit } from "../../hooks";
import { getApiError } from "../../utils/error";
import { formatDate } from "../../utils/formatters";
import "./StudentProfilePage.css";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  marshal: "Field Marshal",
  admin: "Campus Administrator",
  org_admin: "Organization Administrator",
  super_admin: "Super Admin",
  staff: "Faculty & Staff",
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

  // ─── Data Loading ───
  const loadProfileData = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      setError(null);
    } catch (err: any) {
      if (user) {
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
        .catch(() => { });
    }
  }, [user, loadProfile]);

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  // ─── Edit Logic ───
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

  // ─── Consent Logic ───
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

  // ─── Data Removal Logic ───
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

  // ─── Photo Logic ───
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

  // ─── Derived State ───
  const effectiveRole = profile?.role || user?.role || "student";
  const isStudent = effectiveRole === "student" || effectiveRole === "staff";
  const isMarshal = effectiveRole === "marshal";
  const isOrgAdmin = effectiveRole === "org_admin";
  const isAdmin = effectiveRole === "admin" || effectiveRole === "super_admin" || effectiveRole === "org_admin";
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "User Profile";
  const roleLabel = ROLE_LABELS[effectiveRole] || "User";
  const isEnrolled = profile?.registration_status === "complete" || (profile?.num_embeddings ? profile.num_embeddings > 0 : false);
  const hasPhoto = !!(profile?.profile_photo_url || user?.profile_photo_url);

  return (
    <div className="profile-page">
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
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────
          IDENTITY BLOCK
          Mobile: centered contact card
          Desktop: horizontal header with avatar left
          ───────────────────────────────────────────────────── */}
      <div className="profile-identity-block">
        <Menu shadow="md" width={180} position="bottom">
          <Menu.Target>
            <div className="profile-identity-avatar-wrap">
              <Avatar
                src={profile?.profile_photo_url || user?.profile_photo_url}
                firstName={profile?.first_name || user?.first_name}
                lastName={profile?.last_name || user?.last_name}
                size="lg"
              />
              <div className="profile-avatar-camera-hint">
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
            {hasPhoto && (
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

        <div className="profile-identity-meta">
          <div className="profile-identity-name">
            {loading ? <Skeleton height={24} width={180} /> : fullName}
          </div>
          <div className="profile-identity-subtitle">
            {roleLabel}
            {(institution?.name || profile?.department_name) && (
              <> · {institution?.name || profile?.department_name}</>
            )}
          </div>

          {/* Status Chips */}
          <div className="profile-status-chips">
            {profile?.attendee_type && (
              <span className="profile-chip neutral" style={{ textTransform: "capitalize" }}>
                {profile.attendee_type}
              </span>
            )}
            {isOrgAdmin && (
              <span className="profile-chip brand">
                <IconBuildingCommunity size={11} />
                Organization Admin
              </span>
            )}
            {isStudent && isEnrolled && (
              <span className="profile-chip success">
                <IconCheck size={11} />
                Face ID Active
              </span>
            )}
            {isStudent && !isEnrolled && (
              <span className="profile-chip warning">
                <IconAlertTriangle size={11} />
                Face ID Required
              </span>
            )}
            {isMarshal && (
              <span className="profile-chip brand">
                <IconScan size={11} />
                Kiosk Certified Marshal
              </span>
            )}
            {!isOrgAdmin && !isMarshal && (
              <span className="profile-chip neutral">
                {roleLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────
          UNENROLLED CTA — Only when Face ID not set up
          ───────────────────────────────────────────────────── */}
      {isStudent && !isEnrolled && (
        <div className="profile-enroll-cta">
          <div>
            <Button
              className="btn-brand"
              size="sm"
              leftSection={<IconScan size={15} />}
              loading={consentCheckLoading}
              onClick={handleStartRegistration}
              fullWidth
            >
              Set Up Face Biometrics
            </Button>
          </div>
          <span className="profile-enroll-cta-text">
            Your face scan enables contactless check-in at campus kiosk stations.
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────
          MARSHAL QUICK-ACTION BANNER
          ───────────────────────────────────────────────────── */}
      {isMarshal && (
        <div className="profile-marshal-banner">
          <div className="profile-marshal-banner-text">
            <span className="profile-marshal-title">Scanner Kiosk</span>
            <span className="profile-marshal-subtitle">
              {institution?.name || "Campus Station"}
            </span>
          </div>
          <Button
            component={Link}
            to="/marshal/scanner"
            className="btn-brand"
            size="xs"
            leftSection={<IconScan size={14} />}
          >
            Launch
          </Button>
        </div>
      )}

      <div className="profile-divider" />

      {/* ─────────────────────────────────────────────────────
          CONTENT — Two-column on desktop, stacked on mobile
          ───────────────────────────────────────────────────── */}
      <div className="profile-content">
        <div className="profile-content-grid">
          {/* ─── Left Column: Details ─── */}
          <div className="profile-content-column">
            {!editing ? (
              <>
                <div className="profile-section-label">Details</div>

                <div className="profile-field">
                  <span className="profile-field-label">Full Name</span>
                  <span className="profile-field-value">
                    {loading ? <Skeleton height={16} width={140} /> : fullName}
                  </span>
                </div>

                <div className="profile-field">
                  <span className="profile-field-label">
                    {isStudent ? "Student ID" : "Identifier"}
                  </span>
                  <span className="profile-field-value mono">
                    {loading ? <Skeleton height={16} width={100} /> : (profile?.identifier || "—")}
                  </span>
                </div>

                <div className="profile-field">
                  <span className="profile-field-label">Email</span>
                  <span className="profile-field-value">
                    {profile?.email || "—"}
                  </span>
                </div>

                {profile?.department_name && (
                  <div className="profile-field">
                    <span className="profile-field-label">Department</span>
                    <span className="profile-field-value">
                      {profile.department_name}
                    </span>
                  </div>
                )}

                {isStudent && summary && (
                  <div className="profile-field">
                    <span className="profile-field-label">Attendance</span>
                    <span className="profile-field-value">
                      {summary.attendance_rate}% · {summary.total_events_attended} sessions
                    </span>
                  </div>
                )}

                <div className="profile-divider" />

                {/* Action Rows */}
                <button className="profile-action-row" onClick={startEditing}>
                  <span className="profile-action-row-label">Edit Profile</span>
                  <IconChevronRight size={16} className="profile-action-row-chevron" />
                </button>

                {isStudent && isEnrolled && (
                  <button
                    className="profile-action-row"
                    onClick={handleStartRegistration}
                    disabled={consentCheckLoading}
                  >
                    <span className="profile-action-row-label">Retake Face Scan</span>
                    <IconChevronRight size={16} className="profile-action-row-chevron" />
                  </button>
                )}

                {isAdmin && (
                  <Link
                    to={user?.role === "super_admin" ? "/super-admin/institutions" : "/admin/dashboard"}
                    className="profile-action-row"
                    style={{ textDecoration: "none" }}
                  >
                    <span className="profile-action-row-label">Admin Dashboard</span>
                    <IconChevronRight size={16} className="profile-action-row-chevron" />
                  </Link>
                )}
              </>
            ) : (
              /* ─── Edit Form ─── */
              <div className="profile-edit-form">
                <div className="profile-section-label">Edit Profile</div>
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
                >
                  <div className="edit-field-group">
                    <div className="edit-name-row">
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
                    </div>

                    <TextInput
                      label={isStudent ? "Student ID" : "Staff Identifier"}
                      value={editForm.identifier}
                      onChange={(e) => setEditForm((f) => ({ ...f, identifier: e.currentTarget.value }))}
                      required
                      size="sm"
                    />

                    {isStudent && departments.length > 0 && (
                      <Select
                        label="Department"
                        placeholder="Select department"
                        data={departments.map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` }))}
                        value={editForm.department_id}
                        onChange={(val) => setEditForm((f) => ({ ...f, department_id: val || "" }))}
                        clearable
                        size="sm"
                      />
                    )}

                    <div className="edit-actions">
                      <Button variant="default" size="sm" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" color="blue" loading={submitting}>
                        Save
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* ─── Right Column: Security & Privacy ─── */}
          <div className="profile-content-column">
            <div className="profile-section-label">Account & Role</div>

            <div className="profile-field">
              <span className="profile-field-label">System Role</span>
              <span className="profile-field-value">{roleLabel}</span>
            </div>

            {profile?.attendee_type && (
              <div className="profile-field">
                <span className="profile-field-label">Academic Status</span>
                <span className="profile-field-value" style={{ textTransform: "capitalize" }}>
                  {profile.attendee_type}
                </span>
              </div>
            )}

            {isStudent && (
              <div className="profile-field">
                <span className="profile-field-label">Consent</span>
                <span className="profile-field-value">
                  {profile?.consent_given ? "✓ Granted" : "Pending"}
                </span>
              </div>
            )}

            <div className="profile-field">
              <span className="profile-field-label">Member Since</span>
              <span className="profile-field-value dimmed">
                {profile?.created_at ? formatDate(profile.created_at) : "—"}
              </span>
            </div>

            {/* Dynamic Assigned Organizations Leadership */}
            {profile?.assigned_organizations && profile.assigned_organizations.length > 0 && (
              <>
                <div className="profile-divider" />
                <div className="profile-section-label" style={{ marginTop: "0.5rem" }}>
                  Department Leadership Roles
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.35rem" }}>
                  {profile.assigned_organizations.map((org) => (
                    <div
                      key={org.organization_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "8px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {org.organization_name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--mantine-color-dimmed)" }}>
                          {org.organization_code}
                        </div>
                      </div>
                      <Badge
                        color={org.org_role === "admin" ? "indigo" : "teal"}
                        variant="light"
                        size="sm"
                      >
                        {org.org_role === "admin" ? "Org Admin" : "Field Marshal"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}

            {isStudent && (
              <>
                <div className="profile-divider" />
                <button
                  className="profile-action-row destructive"
                  onClick={() => setRemovalModalOpen(true)}
                >
                  <span className="profile-action-row-label">Request Data Removal</span>
                  <IconChevronRight size={16} className="profile-action-row-chevron" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="profile-footer-meta">
        {profile?.email || user?.email}
      </div>

      {/* ─── Modals (preserved from original) ─── */}
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

      <ConsentForm
        opened={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        onConfirm={handleConsent}
        loading={consentLoading}
      />

      <Modal
        opened={removalModalOpen}
        onClose={() => setRemovalModalOpen(false)}
        title="Request Data Removal"
      >
        <Stack gap="md">
          <Alert color="orange" title="This action is irreversible">
            Your facial biometric data will be permanently deleted. You won't be able to use face recognition check-in until you re-enroll.
          </Alert>
          <Textarea
            label="Reason (optional)"
            placeholder="Why are you requesting removal?"
            value={removalReason}
            onChange={(e) => setRemovalReason(e.currentTarget.value)}
          />
          <Checkbox
            label="I understand my biometric data will be permanently removed"
            checked={removalChecked}
            onChange={(e) => setRemovalChecked(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRemovalModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" disabled={!removalChecked} loading={removalLoading} onClick={handleRemoval}>
              Confirm Removal
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
