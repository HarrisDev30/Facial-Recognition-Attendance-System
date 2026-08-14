import { Container, Paper, Title, Text } from "@mantine/core";

export default function NotAuthorized() {
  return (
    <Container py="xl" ta="center">
      <Paper p="xl" withBorder>
        <Title order={3}>Not Authorized</Title>
        <Text c="dimmed" my="md">
          You don't have permission to access this page.
        </Text>
      </Paper>
    </Container>
  );
}
