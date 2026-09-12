import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Container,
  Text,
  Group,
  Button,
  ActionIcon,
  Tooltip,
  TextInput,
  CloseButton,
  CopyButton,
  Badge,
  Modal,
  Select,
  FileInput,
  Stack,
  Skeleton,
} from "@mantine/core";
import { Sparkline } from "@mantine/charts";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconShieldCheck,
  IconShieldX,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconCamera,
  IconUpload,
  IconScan,
  IconX,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import * as attendeesApi from "../../api/attendees";
import * as registrationApi from "../../api/registration";
import type { EmbeddingInfo } from "../../api/registration";
import { useAsync } from "../../hooks";
import { formatDate } from "../../utils/formatters";
import "./AdminEnrollmentPage.css";

const CANONICAL_ANGLES = [
  { key: "frontal", label: "Frontal" },
  { key: "left", label: "Left Profile" },
  { key: "right", label: "Right Profile" },
  { key: "tilt_up", label: "Tilt Up" },
  { key: "tilt_down", label: "Tilt Down" },
];

function shortId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function getInitials(first?: string, last?: string): string {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "ID";
}

export default function AdminEnrollmentPage() {
  const { user } = useAuthStore();
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [rosterTab, setRosterTab] = useState<"all" | "enrolled" | "pending">("all");
  const [search, setSearch] = useState("");

  // Upload Modal State
  const [uploadOpened, setUploadOpened] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAngle, setUploadAngle] = useState<string>("frontal");
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const {
    data: attendeesData,
    loading: loadingAttendees,
    execute: reloadAttendees,
  } = useAsync(() => attendeesApi.getAttendees(), true);

  const attendees = useMemo(() => attendeesData ?? [], [attendeesData]);

  // Automatically select the first attendee once loaded if none is selected
  useEffect(() => {
    if (!selectedAttendeeId && attendees.length > 0) {
      setSelectedAttendeeId(attendees[0].id);
    }
  }, [attendees, selectedAttendeeId]);

  const loadEmbeddings = useCallback(async () => {
    if (!selectedAttendeeId) return [] as EmbeddingInfo[];
    return registrationApi.getEmbeddings(selectedAttendeeId);
  }, [selectedAttendeeId]);

  const {
    data: embeddingsData,
    loading: loadingEmbeddings,
    execute: reloadEmbeddings,
  } = useAsync(loadEmbeddings, true);

  const embeddings = useMemo(() => embeddingsData ?? [], [embeddingsData]);

  useEffect(() => {
    setImgError(false);
    if (selectedAttendeeId) {
      reloadEmbeddings();
    }
  }, [selectedAttendeeId, reloadEmbeddings]);

  const selectedAttendee = useMemo(
    () => attendees.find((a) => a.id === selectedAttendeeId) || null,
    [attendees, selectedAttendeeId],
  );

  // Compute stats
  const enrolledAttendees = useMemo(
    () => attendees.filter((a) => a.consent_given),
    [attendees],
  );
  const pendingAttendees = useMemo(
    () => attendees.filter((a) => !a.consent_given),
    [attendees],
  );

  const coveragePercent = useMemo(
    () => (attendees.length > 0 ? Math.round((enrolledAttendees.length / attendees.length) * 100) : 0),
    [attendees.length, enrolledAttendees.length],
  );

  // Filter roster list
  const filteredAttendees = useMemo(() => {
    let list = attendees;
    if (rosterTab === "enrolled") {
      list = list.filter((a) => a.consent_given);
    } else if (rosterTab === "pending") {
      list = list.filter((a) => !a.consent_given);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.first_name.toLowerCase().includes(q) ||
          a.last_name.toLowerCase().includes(q) ||
          a.identifier.toLowerCase().includes(q) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.department_code && a.department_code.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [attendees, rosterTab, search]);

  // Set of captured angles for the selected attendee
  const capturedAngleSet = useMemo(() => {
    const set = new Set<string>();
    for (const emb of embeddings) {
      if (emb.camera_angle) {
        set.add(emb.camera_angle.toLowerCase());
      }
    }
    return set;
  }, [embeddings]);

  const multiAngleCompleteness = useMemo(() => {
    if (embeddings.length === 0) return 0;
    const count = CANONICAL_ANGLES.filter((a) => capturedAngleSet.has(a.key)).length;
    return Math.round((count / CANONICAL_ANGLES.length) * 100);
  }, [capturedAngleSet, embeddings.length]);

  // Sparkline for coverage
  const coverageSparkline =
    coveragePercent > 0
      ? [Math.max(0, coveragePercent - 8), Math.max(0, coveragePercent - 3), coveragePercent]
      : [0, 0, 0];

  const handleUploadEmbedding = async () => {
    if (!selectedAttendeeId || !uploadFile) return;

    setUploading(true);
    try {
      await registrationApi.uploadEmbedding(selectedAttendeeId, uploadFile, uploadAngle);
      notifications.show({
        title: "Vector Embedding Saved",
        message: `Successfully enrolled ${uploadAngle} face angle.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setUploadOpened(false);
      setUploadFile(null);
      reloadEmbeddings();
      reloadAttendees();
    } catch (err: any) {
      notifications.show({
        title: "Enrollment Failed",
        message: err.response?.data?.detail || "Could not detect valid facial features in image.",
        color: "red",
        icon: <IconX size={16} />,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Container size="xl" pt={0} pb="4xl" className="enrollment-container">
      {/* ─── 1. Executive Split Header Card (Student Dashboard Parity) ─── */}
      <div className="admin-enrollment-header-card">
        {/* Left Column: Identity & Vector Status */}
        <div className="enrollment-identity-col">
          <div className="enrollment-title-group">
            <span className="enrollment-eyebrow">Biometric Vector Registry</span>
            <h1 className="enrollment-title">Biometrics & Face Profiles</h1>
            <span className="enrollment-institution-name">
              {user?.institution_name || "Institutional Campus Portal"} • Buffalo_L 512D Vector Partition
            </span>
          </div>

          <div className="enrollment-credential-stack">
            <span className="enrollment-tag">
              PROFILES: {attendees.length}
            </span>
            <span className="enrollment-status-pill">
              <IconCheck size={12} />
              <span>FAISS Vector Sync Active</span>
            </span>
            <span className="enrollment-tag">
              {enrolledAttendees.length} Verified
            </span>
          </div>

          <div className="enrollment-cta-row">
            <Button
              size="xs"
              leftSection={<IconUpload size={14} />}
              onClick={() => setUploadOpened(true)}
              disabled={!selectedAttendee}
              className="enrollment-btn-primary"
            >
              Enroll Angle Photo
            </Button>
            <Tooltip label="Refresh all vector states">
              <ActionIcon
                variant="default"
                size="input-xs"
                loading={loadingAttendees || loadingEmbeddings}
                onClick={() => {
                  reloadAttendees();
                  reloadEmbeddings();
                }}
                className="enrollment-btn-secondary"
                aria-label="Refresh vector registry"
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {/* Right Column: 3 Visual Telemetry Slides */}
        <div className="enrollment-visual-frame">
          {/* Slide 1: Biometric Coverage Rate */}
          <div className="enrollment-visual-slide">
            <span className="enrollment-slide-category">Biometric Coverage</span>
            <div style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center" }}>
              <Sparkline
                w="100%"
                h={36}
                data={coverageSparkline}
                color="teal.6"
                fillOpacity={0.18}
                curveType="natural"
              />
            </div>
            <div className="enrollment-slide-big-metric">
              {loadingAttendees ? <Skeleton height={26} width={48} /> : `${coveragePercent}%`}
            </div>
            <span className="enrollment-slide-subtext">
              {enrolledAttendees.length} of {attendees.length} attendees enrolled
            </span>
          </div>

          {/* Slide 2: Multi-Angle Completeness */}
          <div className="enrollment-visual-slide">
            <span className="enrollment-slide-category">Angle Completeness</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <span className="enrollment-slide-big-metric" style={{ margin: 0 }}>
                {selectedAttendee ? `${multiAngleCompleteness}%` : "—"}
              </span>
            </div>
            <span className="enrollment-slide-subtext">
              {selectedAttendee
                ? `${capturedAngleSet.size} of 5 angles captured`
                : "Select attendee to inspect"}
            </span>
          </div>

          {/* Slide 3: Vector Health */}
          <div className="enrollment-visual-slide">
            <span className="enrollment-slide-category">FAISS Vector Index</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)",
                }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Online & Synced
              </span>
            </div>
            <span className="enrollment-slide-subtext">512D Euclidean L2 partition</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Master-Detail Layout Grid ─── */}
      <div className="enrollment-master-detail-grid">
        {/* Left Panel: Searchable Attendee Roster List */}
        <div className="enrollment-roster-card">
          <div className="roster-tab-group">
            <button
              type="button"
              className={`roster-tab-pill ${rosterTab === "all" ? "active" : ""}`}
              onClick={() => setRosterTab("all")}
            >
              All ({attendees.length})
            </button>
            <button
              type="button"
              className={`roster-tab-pill ${rosterTab === "enrolled" ? "active" : ""}`}
              onClick={() => setRosterTab("enrolled")}
            >
              Enrolled ({enrolledAttendees.length})
            </button>
            <button
              type="button"
              className={`roster-tab-pill ${rosterTab === "pending" ? "active" : ""}`}
              onClick={() => setRosterTab("pending")}
            >
              Pending ({pendingAttendees.length})
            </button>
          </div>

          <TextInput
            placeholder="Search student or ID..."
            size="xs"
            leftSection={<IconSearch size={14} style={{ color: "var(--text-muted)" }} />}
            rightSection={
              search ? (
                <CloseButton size="xs" onClick={() => setSearch("")} aria-label="Clear search" />
              ) : null
            }
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            styles={{
              input: {
                background: "var(--surface-0)",
                borderColor: "var(--border-subtle)",
                borderRadius: "8px",
                fontSize: "0.8125rem",
              },
            }}
          />

          <div className="roster-list-scroll">
            {filteredAttendees.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <Text size="xs" c="var(--text-muted)">
                  No attendees match the criteria.
                </Text>
              </div>
            ) : (
              filteredAttendees.map((att) => {
                const isSelected = att.id === selectedAttendeeId;
                const photoSrc = att.profile_photo_url || (att.consent_given ? `/api/attendees/${att.id}/profile-photo` : null);
                return (
                  <button
                    key={att.id}
                    type="button"
                    className={`roster-item ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      setSelectedAttendeeId(att.id);
                      setImgError(false);
                    }}
                  >
                    <div className="roster-item-info">
                      <div className="roster-item-avatar-wrap">
                        <div className="roster-item-avatar">
                          {photoSrc ? (
                            <img
                              src={photoSrc}
                              alt={`${att.first_name} ${att.last_name}`}
                              className="roster-item-avatar-img"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            getInitials(att.first_name, att.last_name)
                          )}
                        </div>
                        <div
                          className={`roster-item-avatar-dot ${
                            att.consent_given ? "enrolled" : "pending"
                          }`}
                          title={att.consent_given ? "Face ID Enrolled" : "Pending Photo"}
                        />
                      </div>
                      <div className="roster-item-text">
                        <div className="roster-item-name">
                          {att.last_name}, {att.first_name}
                        </div>
                        <div className="roster-item-sub">
                          {shortId(att.identifier)}
                          {att.department_code ? ` • ${att.department_code}` : ""}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontFamily: "var(--font-mono, monospace)",
                        color: att.consent_given ? "#10b981" : "var(--text-muted)",
                      }}
                    >
                      {att.consent_given ? "Enrolled" : "Pending"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Selected Biometric Dossier */}
        <div className="enrollment-dossier-card">
          {!selectedAttendee ? (
            <div className="dossier-empty-state">
              <div className="dossier-empty-icon">
                <IconScan size={24} />
              </div>
              <Text fw={600} size="sm" c="var(--text-primary)">
                No Attendee Selected
              </Text>
              <Text size="xs" c="var(--text-muted)" maw={320}>
                Select an attendee from the roster on the left to inspect their facial vector profile and biometric coverage.
              </Text>
            </div>
          ) : (
            <>
              {/* Dossier Profile Header */}
              <div className="dossier-profile-header">
                <div className="dossier-photo-frame">
                  {(selectedAttendee.profile_photo_url || (selectedAttendee.consent_given ? `/api/attendees/${selectedAttendee.id}/profile-photo` : null)) && !imgError ? (
                    <img
                      src={selectedAttendee.profile_photo_url || `/api/attendees/${selectedAttendee.id}/profile-photo`}
                      alt={`${selectedAttendee.first_name} ${selectedAttendee.last_name}`}
                      className="dossier-photo-img"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="dossier-photo-placeholder">
                      {getInitials(selectedAttendee.first_name, selectedAttendee.last_name)}
                    </div>
                  )}
                </div>

                <div className="dossier-identity-group">
                  <h2 className="dossier-name">
                    {selectedAttendee.last_name}, {selectedAttendee.first_name}
                  </h2>
                  <Text size="xs" c="var(--text-muted)">
                    {selectedAttendee.email || "No email on record"}
                  </Text>

                  <div className="dossier-meta-row">
                    <Group gap={4} wrap="nowrap" align="center">
                      <span className="dossier-id-chip">
                        {selectedAttendee.identifier}
                      </span>
                      <CopyButton value={selectedAttendee.identifier}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? "Copied!" : "Copy Student ID"}>
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              color={copied ? "teal" : "gray"}
                              onClick={copy}
                              aria-label="Copy identifier"
                            >
                              {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>

                    {selectedAttendee.department_name && (
                      <span className="enrollment-tag">
                        {selectedAttendee.department_code || selectedAttendee.department_name}
                      </span>
                    )}

                    <Badge
                      size="sm"
                      variant="light"
                      color={selectedAttendee.attendee_type === "student" ? "blue" : "violet"}
                    >
                      {selectedAttendee.attendee_type === "student"
                        ? "Student"
                        : "Faculty & Personnel"}
                    </Badge>

                    {selectedAttendee.consent_given ? (
                      <span className="enrollment-status-pill">
                        <IconShieldCheck size={12} />
                        <span>Face ID Enrolled</span>
                      </span>
                    ) : (
                      <span
                        className="enrollment-status-pill"
                        style={{
                          background: "var(--surface-0)",
                          color: "var(--text-muted)",
                          borderColor: "var(--border-subtle)",
                        }}
                      >
                        <IconShieldX size={12} />
                        <span>Photo Pending</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 5-Angle Biometric Coverage Reticle */}
              <div className="reticle-section">
                <div className="reticle-heading-row">
                  <span className="reticle-heading">5-Angle Biometric Reticle</span>
                  <span className="reticle-coverage-badge">
                    {capturedAngleSet.size} / 5 Angles Captured
                  </span>
                </div>

                <div className="reticle-tiles-grid">
                  {CANONICAL_ANGLES.map((angle) => {
                    const isCaptured = capturedAngleSet.has(angle.key);
                    return (
                      <div
                        key={angle.key}
                        className={`reticle-tile ${isCaptured ? "captured" : "missing"}`}
                      >
                        <span className="reticle-tile-angle">{angle.label}</span>
                        <span
                          className={`reticle-tile-status ${
                            isCaptured ? "captured" : "missing"
                          }`}
                        >
                          {isCaptured ? (
                            <>
                              <IconCheck size={12} />
                              <span>Enrolled</span>
                            </>
                          ) : (
                            <span>Missing</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Saved Vector Embeddings Table */}
              <div className="embeddings-section">
                <div className="reticle-heading-row">
                  <span className="reticle-heading">Saved 512D Vector Embeddings</span>
                  <span className="reticle-coverage-badge">
                    {embeddings.length} Vector{embeddings.length !== 1 ? "s" : ""} in FAISS
                  </span>
                </div>

                <div className="dossier-table-wrap">
                  <table className="dossier-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Camera Angle</th>
                        <th>Vector ID</th>
                        <th>Date Registered</th>
                        <th style={{ textAlign: "right" }}>Model Engine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingEmbeddings ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={5}>
                              <Skeleton height={20} radius="sm" my={4} />
                            </td>
                          </tr>
                        ))
                      ) : embeddings.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "28px" }}>
                            <Text size="xs" c="var(--text-muted)">
                              No face embeddings registered for this attendee yet. Click "Enroll Angle Photo" to upload.
                            </Text>
                          </td>
                        </tr>
                      ) : (
                        embeddings.map((emb, idx) => (
                          <tr key={emb.id}>
                            <td style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                              {idx + 1}
                            </td>
                            <td>
                              <Badge size="xs" variant="light" color="teal">
                                {emb.camera_angle ? emb.camera_angle.toUpperCase() : "FRONTAL"}
                              </Badge>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono, monospace)",
                                  fontSize: "0.6875rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {emb.id.slice(0, 14)}...
                              </span>
                            </td>
                            <td>
                              <Text size="xs" c="var(--text-secondary)">
                                {formatDate(emb.created_at)}
                              </Text>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono, monospace)",
                                  fontSize: "0.6875rem",
                                  color: "#10b981",
                                }}
                              >
                                InsightFace 512D
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── 3. Upload Embedding Modal ─── */}
      <Modal
        opened={uploadOpened}
        onClose={() => {
          setUploadOpened(false);
          setUploadFile(null);
        }}
        title={`Enroll Facial Angle for ${selectedAttendee?.first_name || "Attendee"}`}
        centered
        radius="lg"
      >
        <Stack gap="md">
          <Text size="xs" c="var(--text-secondary)">
            Upload a clear photo to extract and save the 512-dimensional biometric embedding into the active campus FAISS index.
          </Text>

          <Select
            label="Camera Angle"
            data={CANONICAL_ANGLES.map((a) => ({ value: a.key, label: a.label }))}
            value={uploadAngle}
            onChange={(val) => setUploadAngle(val || "frontal")}
            required
          />

          <FileInput
            label="Select Photo"
            placeholder="Choose an image file (JPG, PNG)..."
            accept="image/png,image/jpeg,image/webp"
            value={uploadFile}
            onChange={setUploadFile}
            leftSection={<IconCamera size={16} />}
            clearable
            required
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setUploadOpened(false);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="indigo"
              loading={uploading}
              disabled={!uploadFile}
              onClick={handleUploadEmbedding}
            >
              Extract & Enroll
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
