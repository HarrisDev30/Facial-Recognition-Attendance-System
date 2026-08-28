import { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  ColorInput,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Box,
  Badge,
  Avatar,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingCommunity,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import client from "../../api/client";
import { useAuthStore } from "../../store/authStore";

interface InstitutionData {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  brand_color: string | null;
  is_active: boolean;
}

export default function InstitutionSettingsPage() {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#0070f3");

  useEffect(() => {
    loadInstitution();
  }, []);

  const loadInstitution = async () => {
    try {
      const res = await client.get<InstitutionData>("/api/institutions/my-institution");
      setName(res.data.name || "");
      setCode(res.data.code || "");
      setLogoUrl(res.data.logo_url || "");
      setBrandColor(res.data.brand_color || "#0070f3");
    } catch {
      notifications.show({
        title: "Error Loading Settings",
        message: "Could not retrieve institution branding settings.",
        color: "red",
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.patch<InstitutionData>("/api/institutions/my-institution", {
        name,
        code,
        logo_url: logoUrl,
        brand_color: brandColor,
      });
      notifications.show({
        title: "Branding Updated",
        message: "Campus name, logo, and theme color have been successfully saved!",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.response?.data?.detail || "Could not save branding configuration.",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap="xs">
              <IconBuildingCommunity size={26} color="var(--mantine-color-blue-filled)" />
              <Title order={2}>Campus Branding & Institutional Settings</Title>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Customize the university appearance, portal logo, primary brand color, and attendance policies.
            </Text>
          </Box>
          <Badge size="lg" variant="gradient" gradient={{ from: "blue", to: "cyan" }}>
            Campus Administrator Portal
          </Badge>
        </Group>

        <form onSubmit={handleSave}>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {/* Left 2 Cols: Form */}
            <Box style={{ gridColumn: "span 2" }}>
              <Paper p="xl" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
                <Stack gap="md">
                  <Title order={4}>Identity & Branding</Title>
                  <Divider />

                  <TextInput
                    label="Official Campus / University Name"
                    placeholder="e.g., Cebu Technological University - Main Campus"
                    required
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                  />

                  <TextInput
                    label="Campus Portal Slug (Unique Identifier)"
                    placeholder="e.g., ctu-main"
                    disabled={user?.role !== "super_admin"}
                    description={
                      user?.role === "super_admin"
                        ? "URL slug for this tenant portal"
                        : "Campus slug identifier managed by system administrators"
                    }
                    value={code}
                    onChange={(e) => setCode(e.currentTarget.value)}
                  />

                  <TextInput
                    label="University Logo URL"
                    placeholder="https://example.edu/logo.png"
                    description="High-resolution transparent PNG or SVG logo for student & admin navigation bars"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.currentTarget.value)}
                  />

                  <ColorInput
                    label="Primary Brand Accent Color"
                    description="This color dynamically accents buttons, badges, and the student navigation header"
                    format="hex"
                    swatches={["#0070f3", "#7c3aed", "#10b981", "#ea580c", "#e11d48", "#0284c7", "#0d9488"]}
                    value={brandColor}
                    onChange={setBrandColor}
                  />

                  <Group justify="flex-end" mt="md">
                    <Button type="submit" loading={saving} leftSection={<IconCheck size={16} />}>
                      Save Campus Branding
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Box>

            {/* Right 1 Col: Live Preview */}
            <Box>
              <Paper p="xl" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
                <Stack gap="md" align="center">
                  <Title order={4} style={{ alignSelf: "flex-start" }}>
                    Live Brand Preview
                  </Title>
                  <Divider style={{ width: "100%" }} />

                  <Avatar
                    src={logoUrl}
                    size={80}
                    radius="md"
                    color="blue"
                    style={{ border: `2px solid ${brandColor || "#0070f3"}` }}
                  >
                    <IconBuildingCommunity size={40} />
                  </Avatar>

                  <Box style={{ textAlign: "center" }}>
                    <Text fw={700} size="md">
                      {name || "University Portal"}
                    </Text>
                    <Badge mt={4} style={{ backgroundColor: brandColor || "#0070f3", color: "#fff" }}>
                      {code || "campus-portal"}
                    </Badge>
                  </Box>

                  <Box
                    p="md"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <Text size="xs" c="dimmed" mb="xs">
                      Sample Student Portal Theme:
                    </Text>
                    <Button fullWidth size="xs" style={{ backgroundColor: brandColor || "#0070f3" }}>
                      Scan Biometric Pass
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </SimpleGrid>
        </form>
      </Stack>
    </Container>
  );
}
