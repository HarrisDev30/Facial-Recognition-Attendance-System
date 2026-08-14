import { Container, Paper, Title, Text, Button, Stack, Anchor, Loader } from "@mantine/core";
import { IconPrinter, IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../hooks";
import { useAuthStore } from "../store/authStore";
import PageHeader from "../components/layout/PageHeader";
import { roleHome } from "../utils/routes";

interface PolicySection {
  heading: string;
  content: string;
}

interface PrivacyPolicy {
  title: string;
  version: string;
  effective_date: string;
  sections: PolicySection[];
}

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: policy, loading } = useAsync(async () => {
    const res = await fetch("/api/privacy/policy");
    return await res.json() as PrivacyPolicy;
  }, true);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <Container size="md" pt={0} pb="4xl">
      <PageHeader title={policy?.title ?? "Privacy Policy"}>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(roleHome(user?.role ?? ""))}
        >
          Back
        </Button>
        <Button
          leftSection={<IconPrinter size={16} />}
          onClick={handlePrint}
        >
          Print
        </Button>
      </PageHeader>

      {policy && (
        <Text size="sm" c="dimmed" mb="xl">
          Version {policy.version} &middot; Effective {policy.effective_date}
        </Text>
      )}

      {/* Table of Contents */}
      <Paper p="md" mb="xl">
        <Title order={4} mb="sm">Contents</Title>
        <Stack gap="xs">
          {(policy?.sections ?? []).map((section, i) => (
            <Anchor key={i} href={`#section-${i}`} size="sm">
              {section.heading}
            </Anchor>
          ))}
        </Stack>
      </Paper>

      {/* Sections */}
      {(policy?.sections ?? []).map((section, i) => (
        <Paper key={i} p="lg" mb="md" id={`section-${i}`}>
          <Title order={4} mb="sm">{section.heading}</Title>
          <Text style={{ whiteSpace: "pre-line" }}>{section.content}</Text>
        </Paper>
      ))}

      {!policy && (
        <Text c="dimmed" ta="center" py="xl">
          Privacy policy content is unavailable. Please contact the administrator.
        </Text>
      )}
    </Container>
  );
}
