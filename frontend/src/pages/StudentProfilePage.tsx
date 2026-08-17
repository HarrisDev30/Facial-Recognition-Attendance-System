import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Paper,
  SimpleGrid,
  Progress,
  Textarea,
  Box,
  Select,
  Menu,
  Skeleton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCamera, IconX } from "@tabler/icons-react";
import { useAuthStore } from "../store/authStore";
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
import PageHeader from "../components/layout/PageHeader";
import Avatar from "../components/Avatar";
import PhotoCropper from "../components/PhotoCropper";
import { useAsync, useFormSubmit } from "../hooks";
import { getApiError } from "../utils/error";
import { formatDate } from "../utils/formatters";
import { roleHome } from "../utils/routes";

export default function StudentProfilePage() {
  const { user } = useAuthStore();
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
  const [avatarHovered, setAvatarHovered] = useState(false);

  const loadProfileData = useCallback(async () => {
    const p = await getMyProfile();
    setProfile(p);
    setError(null);
  }, []);

  const { loading, error: loadError, execute: loadProfile } = useAsync(loadProfileData, false);

  useEffect(() => {
    if (!user) return;
    loadProfile();
    getMyAttendanceSummary()
      .then(setSummary)
      .catch(() => {});
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
        const res = await getDepartments();
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

  const statusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      complete: "teal",
      partial: "orange",
      not_registered: "gray",
    };
    return (
      <Badge color={colorMap[status] || "gray"}>
        {status === "not_registered" ? "Not Registered" : status === "complete" ? "Complete" : status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Container size="md" pt={0} pb="4xl">
        <PageHeader
          title="My Profile & Settings"
          subtitle="Manage your personal details, organization info, and biometric facial registration"
          breadcrumbs={[
            { label: "Dashboard", to: roleHome(user?.role ?? "student") },
            { label: "Profile" },
          ]}
        />
        <Group mb="xl" gap="lg" wrap="nowrap">
          <Skeleton circle width={120} height={120} />
          <Box style={{ flex: 1 }}>
            <Skeleton height={28} width="60%" mb={8} />
            <Skeleton height={16} width="40%" />
          </Box>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <Paper key={i} p="md" radius="md" bg="var(--surface-1)">
              <Skeleton height={12} width="70%" mb={12} />
              <Skeleton height={32} width="50%" />
            </Paper>
          ))}
        </SimpleGrid>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container size="md" pt={0} pb="4xl">
        <PageHeader
          title="My Profile & Settings"
          subtitle="Manage your personal details, organization info, and biometric facial registration"
          breadcrumbs={[
            { label: "Dashboard", to: roleHome(user?.role ?? "student") },
            { label: "Profile" },
          ]}
        />
        <Alert color="red" variant="light">
          Could not load your profile. <Button variant="subtle" size="compact-xs" onClick={loadProfile} ml="xs" color="red">Retry</Button>
        </Alert>
      </Container>
    );
  }

  const embProgress = Math.min((profile.num_embeddings || 0) / 6 * 100, 100);

  const dashboardRoute = roleHome(user?.role ?? "student");

  return (
    <Container size="md" pt={0} pb="4xl">
      <PageHeader
        title="My Profile & Settings"
        subtitle="Manage your personal details, organization info, and biometric facial registration"
        breadcrumbs={[
          { label: "Dashboard", to: dashboardRoute },
          { label: "Profile" },
        ]}
      />

      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Avatar + Name */}
      <Group mb="xl" gap="lg" wrap="nowrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handlePhotoUpload}
        />
        <Menu position="bottom-start" withArrow>
          <Menu.Target>
            <Box
              style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}
              onMouseEnter={() => setAvatarHovered(true)}
              onMouseLeave={() => setAvatarHovered(false)}
            >
              <Avatar
                src={profile.profile_photo_url}
                firstName={profile.first_name}
                lastName={profile.last_name}
                size="lg"
                loading={photoUploading}
              />
              <Box
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.45)",
                  display: avatarHovered ? "flex" : "none",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "opacity 0.15s ease",
                  pointerEvents: "none",
                }}
              >
                <IconCamera size={22} style={{ color: "#fff" }} />
              </Box>
            </Box>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconCamera size={16} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload New Photo
            </Menu.Item>
            {profile.profile_photo_url && (
              <Menu.Item
                leftSection={<IconX size={16} />}
                color="red"
                onClick={handlePhotoRemove}
              >
                Remove Photo
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
        <div>
          <Text fw={700} size="lg" lh={1.2}>
            {profile.first_name} {profile.last_name}
          </Text>
          <Text size="sm" c="dimmed">
            {profile.department_name || "\u2014"}
            {profile.department_code ? ` (${profile.department_code})` : ""}
          </Text>
        </div>
      </Group>

      {/* Stat Cards */}
      {summary && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
          <Paper
            p="md"
            radius="md"
            bg="rgba(45, 212, 191, 0.06)"
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              Events Attended
            </Text>
            <Text size="2rem" fw={700} lh={1} c="#2dd4bf">
              {summary.total_events_attended}
            </Text>
          </Paper>
          <Paper
            p="md"
            radius="md"
            bg="rgba(34, 197, 94, 0.06)"
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              Attendance Rate
            </Text>
            <Text
              size="2rem"
              fw={700}
              lh={1}
              c={summary.attendance_rate >= 75 ? "#22c55e" : "#f97316"}
            >
              {summary.attendance_rate}%
            </Text>
          </Paper>
          <Paper
            p="md"
            radius="md"
            bg="rgba(34, 211, 238, 0.06)"
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              Last Check-in
            </Text>
            <Text size="xl" fw={700} lh={1} c="#22d3ee">
              {summary.last_attendance ? formatDate(summary.last_attendance) : "\u2014"}
            </Text>
          </Paper>
          <Paper
            p="md"
            radius="md"
            bg="rgba(168, 85, 247, 0.06)"
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              Available Events
            </Text>
            <Text size="2rem" fw={700} lh={1} c="#a855f7">
              {summary.total_events_available}
            </Text>
          </Paper>
        </SimpleGrid>
      )}

      {/* Account Info + Biometrics — 2 columns */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper p="md" radius="md" bg="var(--surface-1)">
          {!editing && (
            <Group justify="flex-end" mb="sm">
              <Button variant="default" size="xs" onClick={startEditing}>
                Edit
              </Button>
            </Group>
          )}

          {editing ? (
            <Stack gap="sm">
              <TextInput
                label="First Name"
                value={editForm.first_name}
                onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.currentTarget.value }))}
              />
              <TextInput
                label="Last Name"
                value={editForm.last_name}
                onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.currentTarget.value }))}
              />
              <TextInput
                label="Student ID"
                value={editForm.identifier}
                onChange={(e) => setEditForm((p) => ({ ...p, identifier: e.currentTarget.value }))}
              />
              <Select
                label="Department"
                value={editForm.department_id || null}
                onChange={(v) => setEditForm((p) => ({ ...p, department_id: v || "" }))}
                data={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                searchable
                clearable
              />
              <Group mt="sm">
                <Button onClick={() => saveProfile(editForm)} loading={submitting}>
                  Save
                </Button>
                <Button variant="default" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="sm">
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Student ID" value={profile.identifier || "\u2014"} />
              <InfoRow
                label="Department"
                value={
                  profile.department_name
                    ? `${profile.department_name}${profile.department_code ? ` (${profile.department_code})` : ""}`
                    : "\u2014"
                }
              />
              <InfoRow
                label="Type"
                value={
                  profile.attendee_type
                    ? profile.attendee_type.charAt(0).toUpperCase() + profile.attendee_type.slice(1)
                    : "\u2014"
                }
              />
            </Stack>
          )}
        </Paper>

        <Paper p="md" radius="md" bg="var(--surface-1)">
          <Text size="sm" fw={600} mb="md">
            Biometric Registration
          </Text>

          <Group mb="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Status
            </Text>
            {statusBadge(profile.registration_status)}
          </Group>

          <Progress
            value={embProgress}
            size="md"
            radius="sm"
            color={embProgress >= 100 ? "green" : embProgress > 0 ? "blue" : "gray"}
            striped={embProgress > 0 && embProgress < 100}
            animated={embProgress > 0 && embProgress < 100}
            mb="xs"
          />

          <Text size="xs" c="dimmed" mb="md">
            {profile.num_embeddings || 0} / 6 angles captured
          </Text>

          <Button
            variant="default"
            leftSection={<IconCamera size={16} />}
            fullWidth
            loading={consentCheckLoading}
            onClick={handleStartRegistration}
          >
            {profile.num_embeddings && profile.num_embeddings > 0
              ? "Continue Registration"
              : "Register Biometrics"}
          </Button>

          {(profile.num_embeddings ?? 0) > 0 && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              mt="sm"
              fullWidth
              onClick={() => setRemovalModalOpen(true)}
            >
              Request Data Removal
            </Button>
          )}
        </Paper>
      </SimpleGrid>

      <PhotoCropper
        opened={cropperOpen}
        imageSrc={cropperImageSrc}
        onClose={() => {
          setCropperOpen(false);
          setCropperImageSrc(null);
        }}
        onSave={handleCropperSave}
        aspectRatio={1}
        cropShape="round"
      />

      <ConsentForm
        opened={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        onConfirm={handleConsent}
        loading={consentLoading}
      />

      <Modal
        opened={removalModalOpen}
        onClose={() => {
          setRemovalModalOpen(false);
          setRemovalChecked(false);
          setRemovalReason("");
        }}
        title="Request Data Removal"
        size="md"
      >
        <Stack>
          <Alert color="red">
            This action is permanent. Your facial embeddings will be deleted.
            Attendance records will be retained for institutional compliance.
          </Alert>
          <Textarea
            label="Reason (optional)"
            placeholder="Please tell us why you are requesting data removal..."
            value={removalReason}
            onChange={(e) => setRemovalReason(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={4}
          />
          <Checkbox
            label="I understand my biometric embeddings will be deleted"
            checked={removalChecked}
            onChange={(e) => setRemovalChecked(e.currentTarget.checked)}
          />
          <Group mt="md">
            <Button
              color="red"
              onClick={handleRemoval}
              disabled={!removalChecked}
              loading={removalLoading}
            >
              Submit Request
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setRemovalModalOpen(false);
                setRemovalChecked(false);
                setRemovalReason("");
              }}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ minWidth: 100 }}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}
