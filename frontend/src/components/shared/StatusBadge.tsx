import { Badge } from "@mantine/core";
import { STATUS_COLORS } from "../../utils/constants";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  return (
    <Badge color={STATUS_COLORS[status] ?? "gray"} size={size}>
      {status}
    </Badge>
  );
}
