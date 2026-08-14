import { Component, type ReactNode, type ErrorInfo } from "react";
import { Container, Paper, Title, Text, Button } from "@mantine/core";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <Container py="xl" ta="center">
          <Paper p="xl" withBorder>
            <Title order={3} mb="md">Something went wrong</Title>
            <Text c="dimmed" mb="lg" size="sm">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </Text>
            <Button onClick={this.handleRetry}>Try again</Button>
          </Paper>
        </Container>
      );
    }
    return this.props.children;
  }
}
