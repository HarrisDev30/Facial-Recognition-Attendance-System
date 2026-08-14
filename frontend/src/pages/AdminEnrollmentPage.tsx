import { useState, useCallback, useEffect } from "react";
import {
  Container,
  Text,
  Select,
  Badge,
  Table,
} from "@mantine/core";
import * as attendeesApi from "../api/attendees";
import * as registrationApi from "../api/registration";
import type { EmbeddingInfo } from "../api/registration";
import { useAsync } from "../hooks";
import PageHeader from "../components/layout/PageHeader";
import SectionCard from "../components/SectionCard";

const CAMERA_ANGLE_LABELS: Record<string, string> = {
  frontal: "Front",
  left: "Left",
  right: "Right",
  tilt_up: "Up",
  tilt_down: "Down",
  random: "Natural",
};

export default function AdminEnrollmentPage() {
  const [selectedAttendee, setSelectedAttendee] = useState<string | null>(null);

  const { data: attendeesData } = useAsync(
    () => attendeesApi.getAttendees(),
    true,
  );

  const attendees = attendeesData ?? [];

  const loadEmbeddings = useCallback(async () => {
    if (!selectedAttendee) return [] as EmbeddingInfo[];
    return registrationApi.getEmbeddings(selectedAttendee);
  }, [selectedAttendee]);

  const { data: embeddings, execute: reloadEmbeddings } = useAsync(loadEmbeddings, true);

  useEffect(() => {
    if (selectedAttendee) {
      reloadEmbeddings();
    }
  }, [selectedAttendee, reloadEmbeddings]);

  const attendee = attendees.find((a) => a.id === selectedAttendee);

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader title="Biometric Status" />

      <SectionCard title="Attendee">
        <Select
          label="Select Attendee"
          placeholder="Choose an attendee..."
          value={selectedAttendee}
          onChange={setSelectedAttendee}
          data={attendees.map((a) => ({
            value: a.id,
            label: `${a.last_name}, ${a.first_name} (${a.identifier})`,
          }))}
          searchable
          clearable
          mb="lg"
        />

        {attendee && (
          <div>
            <Text fw={500}>
              {attendee.last_name}, {attendee.first_name}
            </Text>
            <Text size="sm" c="dimmed">
              ID: {attendee.identifier}
              {attendee.email ? ` \u00b7 ${attendee.email}` : ""}
            </Text>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Saved Embeddings">
        {!embeddings || embeddings.length === 0 ? (
          <Text size="sm" c="dimmed">
            No face embeddings saved yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Angle</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {embeddings.map((emb: EmbeddingInfo, idx: number) => (
                <Table.Tr key={emb.id}>
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td>
                    <Badge>{CAMERA_ANGLE_LABELS[emb.camera_angle ?? ""] ?? emb.camera_angle ?? "N/A"}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Date(emb.created_at).toLocaleDateString()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </SectionCard>
    </Container>
  );
}
