import { Group, Text, Badge, Image, Box } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import { useInstitutionTheme } from "../../theme/InstitutionThemeProvider";

interface WordmarkProps {
  onClick?: () => void;
}

export default function Wordmark({ onClick }: WordmarkProps) {
  const { institution } = useInstitutionTheme();

  return (
    <Group
      gap={8}
      align="center"
      wrap="nowrap"
      style={{
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        minWidth: 0,
      }}
      onClick={onClick}
      className="btn-pressable"
    >
      {/* Stark, Clean White Attendify Icon Mark */}
      <div className="brand-logo-mark" style={{ flexShrink: 0 }}>
        <IconScan size={18} stroke={2.5} style={{ color: "#ffffff" }} />
      </div>

      <Text
        fw={700}
        size="md"
        style={{
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        Attendify
      </Text>

      {/* Institution Affiliation Badge (Hidden on mobile to eliminate header clutter) */}
      {institution && (
        <Box visibleFrom="sm">
          <Group gap={4} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" style={{ opacity: 0.4 }}>
              /
            </Text>
            {institution.logo_url ? (
              <Image
                src={institution.logo_url}
                alt={institution.name}
                w={18}
                h={18}
                fit="contain"
                style={{ borderRadius: 4, flexShrink: 0 }}
              />
            ) : null}
            <Badge
              size="xs"
              variant="light"
              styles={{
                root: {
                  backgroundColor: "var(--brand-surface)",
                  color: "var(--brand-primary)",
                  border: "1px solid var(--brand-border)",
                  fontWeight: 700,
                  letterSpacing: "0.2px",
                  textTransform: "uppercase",
                  maxWidth: 90,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            >
              {institution.code}
            </Badge>
          </Group>
        </Box>
      )}
    </Group>
  );
}
