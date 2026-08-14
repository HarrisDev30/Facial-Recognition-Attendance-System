import { Badge } from "@mantine/core";
import {
  VERIFICATION_METHOD_LABELS,
  VERIFICATION_METHOD_COLORS,
} from "../../utils/constants";

interface VerificationBadgeProps {
  method: string;
  size?: "sm" | "md" | "lg";
}

export default function VerificationBadge({ method, size = "sm" }: VerificationBadgeProps) {
  return (
    <Badge color={VERIFICATION_METHOD_COLORS[method] ?? "gray"} size={size}>
      {VERIFICATION_METHOD_LABELS[method] ?? method}
    </Badge>
  );
}
