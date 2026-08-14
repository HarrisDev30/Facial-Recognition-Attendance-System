import { Text } from "@mantine/core";

interface WordmarkProps {
  onClick?: () => void;
}

export default function Wordmark({ onClick }: WordmarkProps) {
  return (
    <Text
      fw={600}
      size="xl"
      style={{ letterSpacing: "-0.6px", cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      Attendance
    </Text>
  );
}
