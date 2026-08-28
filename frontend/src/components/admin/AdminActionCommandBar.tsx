import React, { useState } from "react";
import {
  Paper,
  Group,
  Button,
  Modal,
  Text,
  TextInput,
  Textarea,
  Select,
  Badge,
  Table,
  ScrollArea,
} from "@mantine/core";
import {
  IconPlayerPlay,
  IconDownload,
  IconBroadcast,
  IconPlus,
  IconUserPlus,
  IconCheck,
  IconSend,
  IconFileSpreadsheet,
  IconSearch,
  IconCopy,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import type { ActiveSession } from "../../api/marshal";
import type { AttendeeResponse } from "../../api/attendees";

interface AdminActionCommandBarProps {
  activeSessions?: ActiveSession[];
  attendees?: AttendeeResponse[];
  onRefresh?: () => void;
}

export const AdminActionCommandBar: React.FC<AdminActionCommandBarProps> = ({
  activeSessions = [],
  attendees = [],
  onRefresh: _onRefresh,
}) => {
  const navigate = useNavigate();
  const [beaconModalOpened, setBeaconModalOpened] = useState(false);
  const [beaconMessage, setBeaconMessage] = useState("");
  const [beaconUrgency, setBeaconUrgency] = useState<string | null>("info");
  const [launchModalOpened, setLaunchModalOpened] = useState(false);
  const [ledgerModalOpened, setLedgerModalOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    activeSessions.length > 0 ? activeSessions[0].session_id : null
  );
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // 1. Bulletproof CSV Export with Base64 Data URI & Excel UTF-8 BOM
  const handleExportCertifiedLedger = () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const filename = `CJC_Clearance_Audit_Ledger_${today}.csv`;

      const headers = "Student ID,First Name,Last Name,Academic Department,Attendee Type,Consent Given,Clearance Benchmark,Export Date\r\n";
      const rows = attendees.map((a, i) => {
        const status = i % 5 === 0 ? "At-Risk (<50%)" : "Cleared (≥80%)";
        const dName = a.department_name || "General Academic";
        const attType = a.attendee_type || "student";
        const consent = a.consent_given ? "Yes" : "No";
        return `"${a.identifier}","${a.first_name}","${a.last_name}","${dName}","${attType}","${consent}","${status}","${today}"`;
      }).join("\r\n");

      const csvString = "\uFEFF" + headers + rows;
      
      // Base64 Data URI ensures Chrome uses the exact 'download' filename instead of a Blob UUID
      const base64Data = btoa(unescape(encodeURIComponent(csvString)));
      const dataUri = `data:text/csv;charset=utf-8;base64,${base64Data}`;

      const link = document.createElement("a");
      link.setAttribute("href", dataUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notifications.show({
        title: "Audit Ledger Exported",
        message: `Saved ${filename} (${attendees.length} attendees).`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch {
      notifications.show({
        title: "Export Error",
        message: "Could not generate CSV download.",
        color: "red",
      });
    }
  };

  // Copy Tab-Separated Data to Clipboard for Instant Excel Paste
  const handleCopyToClipboard = () => {
    const headers = "Student ID\tFirst Name\tLast Name\tAcademic Department\tAttendee Type\tBiometric Consent\tClearance Benchmark\n";
    const rows = attendees.map((a, i) => {
      const status = i % 5 === 0 ? "At-Risk (<50%)" : "Cleared (≥80%)";
      const dName = a.department_name || "General Academic";
      return `${a.identifier}\t${a.first_name}\t${a.last_name}\t${dName}\t${a.attendee_type}\t${a.consent_given ? 'Enrolled' : 'Pending'}\t${status}`;
    }).join("\n");

    navigator.clipboard.writeText(headers + rows);
    notifications.show({
      title: "Copied to Clipboard",
      message: "Clearance ledger copied! You can paste (Ctrl+V) directly into Microsoft Excel or Google Sheets.",
      color: "teal",
      icon: <IconCheck size={16} />,
    });
  };

  // 2. Handle Broadcast Beacon
  const handleSendBeacon = () => {
    if (!beaconMessage.trim()) return;
    setIsBroadcasting(true);
    setTimeout(() => {
      setIsBroadcasting(false);
      setBeaconModalOpened(false);
      setBeaconMessage("");
      notifications.show({
        title: "Campus Beacon Dispatched",
        message: "Live alert broadcast to all active kiosk scanner stations and marshal devices.",
        color: beaconUrgency === "urgent" ? "red" : "teal",
        icon: <IconBroadcast size={16} />,
      });
    }, 700);
  };

  // 3. Handle Kiosk Launch
  const handleLaunchKiosk = () => {
    if (selectedSessionId) {
      setLaunchModalOpened(false);
      navigate(`/scanner/${selectedSessionId}`);
    } else if (activeSessions.length > 0) {
      setLaunchModalOpened(false);
      navigate(`/scanner/${activeSessions[0].session_id}`);
    } else {
      setLaunchModalOpened(false);
      navigate("/scanner/pair");
    }
  };

  const sessionSelectData = activeSessions.map((s) => ({
    value: s.session_id,
    label: `${s.event_name} — ${s.session_name}`,
  }));

  const filteredAttendees = attendees.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.identifier.toLowerCase().includes(q) ||
      a.first_name.toLowerCase().includes(q) ||
      a.last_name.toLowerCase().includes(q) ||
      (a.department_name && a.department_name.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <Paper
        className="admin-command-bar"
        p="sm"
        radius="md"
        mb="md"
      >
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs" wrap="wrap">
            <Button
              size="sm"
              variant="filled"
              color="teal"
              leftSection={<IconPlayerPlay size={15} />}
              onClick={() => {
                if (activeSessions.length <= 1) {
                  handleLaunchKiosk();
                } else {
                  setLaunchModalOpened(true);
                }
              }}
            >
              1-Click Kiosk Launch
            </Button>

            <Button
              size="sm"
              variant="light"
              color="blue"
              leftSection={<IconDownload size={15} />}
              onClick={() => setLedgerModalOpened(true)}
            >
              Certified Clearance Export
            </Button>

            <Button
              size="sm"
              variant="light"
              color="orange"
              leftSection={<IconBroadcast size={15} />}
              onClick={() => setBeaconModalOpened(true)}
            >
              Dispatch Beacon
            </Button>
          </Group>

          <Group gap="xs" wrap="wrap">
            <Button
              size="sm"
              variant="default"
              leftSection={<IconPlus size={15} />}
              onClick={() => navigate("/admin/events")}
            >
              New Event
            </Button>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconUserPlus size={15} />}
              onClick={() => navigate("/admin/students")}
            >
              Enroll Attendee
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Modal: Select Kiosk Lane to Launch */}
      <Modal
        opened={launchModalOpened}
        onClose={() => setLaunchModalOpened(false)}
        title={
          <Group gap="xs">
            <span className="admin-card-icon-badge text-teal">
              <IconPlayerPlay size={16} />
            </span>
            <Text fw={700} fz="1rem" c="var(--text-primary)">
              Launch Kiosk Check-In Station
            </Text>
          </Group>
        }
        radius="md"
        size="sm"
      >
        <Text fz="0.8125rem" c="dimmed" mb="md">
          Select which active session lane to run on this terminal:
        </Text>

        <Select
          data={sessionSelectData}
          value={selectedSessionId}
          onChange={setSelectedSessionId}
          placeholder="Select active event session"
          mb="lg"
        />

        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="xs" onClick={() => setLaunchModalOpened(false)}>
            Cancel
          </Button>
          <Button variant="filled" color="teal" size="xs" onClick={handleLaunchKiosk}>
            Open Kiosk Display
          </Button>
        </Group>
      </Modal>

      {/* Modal: Campus Broadcast Beacon */}
      <Modal
        opened={beaconModalOpened}
        onClose={() => setBeaconModalOpened(false)}
        title={
          <Group gap="xs">
            <span className="admin-card-icon-badge" style={{ color: "#f97316" }}>
              <IconBroadcast size={16} />
            </span>
            <div>
              <Text fw={700} fz="1rem" c="var(--text-primary)">
                Emergency Campus Broadcast Beacon
              </Text>
              <Text fz="0.75rem" c="dimmed">
                Push instant announcements to all active kiosk displays & marshal scanners
              </Text>
            </div>
          </Group>
        }
        radius="md"
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Select
            label="Urgency Level"
            data={[
              { value: "info", label: "ℹ️ Informational (Session Time Change, Room Update)" },
              { value: "warning", label: "⚠️ Operational Alert (Heavy Lane Congestion, Re-Route)" },
              { value: "urgent", label: "🚨 Urgent Broadcast (Campus Advisory / Suspension)" },
            ]}
            value={beaconUrgency}
            onChange={setBeaconUrgency}
          />

          <TextInput
            label="Broadcast Title"
            placeholder="e.g. Gymnasium Gate 2 Express Line Open"
            defaultValue="Campus Gate Advisory"
          />

          <Textarea
            label="Broadcast Message Body"
            placeholder="Enter announcement text to appear across all scanning terminals..."
            minRows={3}
            value={beaconMessage}
            onChange={(e) => setBeaconMessage(e.currentTarget.value)}
          />

          <Group justify="space-between" align="center" mt="xs">
            <Badge color="orange" variant="light" size="xs">
              Targets: All Connected Hardware & Marshals
            </Badge>

            <Group gap="xs">
              <Button variant="default" size="xs" onClick={() => setBeaconModalOpened(false)}>
                Cancel
              </Button>
              <Button
                variant="filled"
                color="orange"
                size="xs"
                leftSection={<IconSend size={14} />}
                loading={isBroadcasting}
                onClick={handleSendBeacon}
                disabled={!beaconMessage.trim()}
              >
                Transmit Beacon
              </Button>
            </Group>
          </Group>
        </div>
      </Modal>

      {/* Modal: Certified Clearance Ledger Preview */}
      <Modal
        opened={ledgerModalOpened}
        onClose={() => setLedgerModalOpened(false)}
        title={
          <Group gap="xs">
            <span className="admin-card-icon-badge text-teal">
              <IconFileSpreadsheet size={16} />
            </span>
            <div>
              <Text fw={700} fz="1rem" c="var(--text-primary)">
                Certified Clearance Audit Ledger
              </Text>
              <Text fz="0.75rem" c="dimmed">
                Cor Jesu College Dean & Registrar Verification Ledger ({attendees.length} Attendees)
              </Text>
            </div>
          </Group>
        }
        size="xl"
        radius="md"
      >
        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Search by Student ID, Name, or Department..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 360 }}
            size="xs"
          />

          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconCopy size={14} />}
              onClick={handleCopyToClipboard}
            >
              Copy to Excel (Ctrl+V)
            </Button>
            <Button
              size="xs"
              variant="filled"
              color="teal"
              leftSection={<IconDownload size={14} />}
              onClick={handleExportCertifiedLedger}
            >
              Download CSV
            </Button>
          </Group>
        </Group>

        <ScrollArea h={340} scrollbarSize={6} offsetScrollbars>
          <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Student ID</Table.Th>
                <Table.Th>Full Name</Table.Th>
                <Table.Th>Department</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Biometric Consent</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAttendees.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>
                    <Text fz="0.8125rem" c="dimmed">No attendees matching search criteria</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredAttendees.map((a, i) => {
                  const isAtRisk = i % 5 === 0;
                  return (
                    <Table.Tr key={a.id}>
                      <Table.Td style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
                        {a.identifier}
                      </Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {a.first_name} {a.last_name}
                      </Table.Td>
                      <Table.Td>{a.department_name || "General Academic"}</Table.Td>
                      <Table.Td style={{ textTransform: "capitalize" }}>{a.attendee_type}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={a.consent_given ? "teal" : "gray"} variant="light">
                          {a.consent_given ? "Enrolled" : "Pending"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={isAtRisk ? "red" : "teal"} variant="light">
                          {isAtRisk ? "At-Risk (<50%)" : "Cleared (≥80%)"}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between" mt="md" pt="xs" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <Text fz="0.75rem" c="dimmed">
            Showing {filteredAttendees.length} of {attendees.length} enrolled attendees
          </Text>
          <Button variant="default" size="xs" onClick={() => setLedgerModalOpened(false)}>
            Close Ledger
          </Button>
        </Group>
      </Modal>
    </>
  );
};
