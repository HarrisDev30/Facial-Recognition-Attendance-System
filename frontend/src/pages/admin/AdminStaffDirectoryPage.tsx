import { useEffect, useState, useMemo } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Table,
  Badge,
  TextInput,
  Select,
  Box,
  SimpleGrid,
  Avatar,
} from "@mantine/core";
import {
  IconUsers,
  IconSearch,
  IconShield,
  IconUserCheck,
  IconSchool,
  IconId,
} from "@tabler/icons-react";
import client from "../../api/client";

interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  org_role: string;
  display_role: string;
  is_student_marshal: boolean;
  student_identifier: string | null;
  organization_id: string;
  organization_name: string;
  organization_code: string;
  org_type: string;
}

export default function AdminStaffDirectoryPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string | null>("all");
  const [filterOrg, setFilterOrg] = useState<string | null>("all");

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await client.get<StaffMember[]>("/api/organizations/staff/all");
      setStaffList(res.data);
    } catch {
      // Keep empty list on fallback
    } finally {
      setLoading(false);
    }
  };

  const orgOptions = useMemo(() => {
    const orgs = Array.from(new Set(staffList.map((s) => s.organization_name)));
    return [{ value: "all", label: "All Departments & Clubs" }, ...orgs.map((o) => ({ value: o, label: o }))];
  }, [staffList]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.student_identifier && s.student_identifier.toLowerCase().includes(search.toLowerCase())) ||
        s.organization_name.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        filterRole === "all" ||
        (filterRole === "student_marshal" && s.is_student_marshal) ||
        (filterRole === "marshal" && !s.is_student_marshal && s.org_role === "marshal") ||
        (filterRole === "admin" && s.org_role === "admin");

      const matchesOrg = filterOrg === "all" || s.organization_name === filterOrg;

      return matchesSearch && matchesRole && matchesOrg;
    });
  }, [staffList, search, filterRole, filterOrg]);

  const studentMarshalCount = staffList.filter((s) => s.is_student_marshal).length;
  const deptAdminCount = staffList.filter((s) => s.org_role === "admin").length;
  const fieldMarshalCount = staffList.filter((s) => s.org_role === "marshal" && !s.is_student_marshal).length;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap="xs">
              <IconUsers size={26} color="var(--mantine-color-blue-filled)" />
              <Title order={2}>Campus Staff & Field Marshal Directory</Title>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Centralized roster of department chairs, field marshals, and appointed student marshals across all colleges and clubs.
            </Text>
          </Box>
          <Badge size="lg" variant="gradient" gradient={{ from: "blue", to: "indigo" }}>
            {staffList.length} Appointed Officers
          </Badge>
        </Group>

        {/* Metrics Cards */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Paper p="md" radius="md" withBorder style={{ background: "rgba(59, 130, 246, 0.05)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Department Admins / Deans
              </Text>
              <IconShield size={18} color="#3b82f6" />
            </Group>
            <Title order={2} mt="xs">
              {deptAdminCount}
            </Title>
            <Text size="xs" c="dimmed">College chairs & sub-unit administrators</Text>
          </Paper>

          <Paper p="md" radius="md" withBorder style={{ background: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Student Marshals
              </Text>
              <IconSchool size={18} color="#10b981" />
            </Group>
            <Title order={2} mt="xs">
              {studentMarshalCount}
            </Title>
            <Text size="xs" c="dimmed">Active students appointed as event marshals</Text>
          </Paper>

          <Paper p="md" radius="md" withBorder style={{ background: "rgba(245, 158, 11, 0.05)", borderColor: "rgba(245, 158, 11, 0.2)" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Field Staff Marshals
              </Text>
              <IconUserCheck size={18} color="#f59e0b" />
            </Group>
            <Title order={2} mt="xs">
              {fieldMarshalCount}
            </Title>
            <Text size="xs" c="dimmed">Dedicated institutional kiosk operators</Text>
          </Paper>
        </SimpleGrid>

        {/* Filters */}
        <Paper p="md" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <TextInput
              placeholder="Search by name, email, student ID, or department..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Select
              placeholder="Filter by Role"
              data={[
                { value: "all", label: "All Roles" },
                { value: "student_marshal", label: "Student Marshals Only" },
                { value: "marshal", label: "Field Marshals Only" },
                { value: "admin", label: "Department Admins Only" },
              ]}
              value={filterRole}
              onChange={setFilterRole}
            />
            <Select
              placeholder="Filter by Organization"
              data={orgOptions}
              value={filterOrg}
              onChange={setFilterOrg}
            />
          </SimpleGrid>
        </Paper>

        {/* Staff Table */}
        <Paper p="md" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="sm" striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Officer Name & Identity</Table.Th>
                  <Table.Th>Assigned Unit / Club</Table.Th>
                  <Table.Th>Institutional Role</Table.Th>
                  <Table.Th>Student Credentials</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Table.Tr key={i}>
                      <Table.Td colSpan={4}>
                        <Text size="sm" c="dimmed">Loading campus staff roster...</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : filteredStaff.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4} style={{ textAlign: "center", padding: "32px" }}>
                      <Text c="dimmed" size="sm">
                        No staff or marshals match the current search filters.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const roleColor = staff.is_student_marshal
                      ? "teal"
                      : staff.org_role === "admin"
                      ? "blue"
                      : "yellow";

                    return (
                      <Table.Tr key={staff.id}>
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar size="sm" radius="xl" color={roleColor}>
                              {staff.name.slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Text size="sm" fw={600}>
                                {staff.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {staff.email}
                              </Text>
                            </Box>
                          </Group>
                        </Table.Td>

                        <Table.Td>
                          <Box>
                            <Text size="sm" fw={500}>
                              {staff.organization_name}
                            </Text>
                            <Badge size="xs" variant="outline" color="gray">
                              {staff.organization_code} ({staff.org_type})
                            </Badge>
                          </Box>
                        </Table.Td>

                        <Table.Td>
                          <Badge color={roleColor} variant="filled" size="sm">
                            {staff.display_role}
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          {staff.is_student_marshal && staff.student_identifier ? (
                            <Group gap={4}>
                              <IconId size={14} color="#10b981" />
                              <Text size="xs" fw={600} ff="monospace" c="teal">
                                {staff.student_identifier}
                              </Text>
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Faculty / Staff Account
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      </Stack>
    </Container>
  );
}
