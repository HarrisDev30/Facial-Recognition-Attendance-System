import { useMemo } from "react";
import {
  Group,
  Text,
  ColorInput,
  Tooltip,
  Badge,
  Stack,
  Box,
} from "@mantine/core";
import { IconSparkles, IconCheck, IconShieldCheck, IconScan } from "@tabler/icons-react";
import { hexToRgb, getContrastTextColor } from "../../theme/InstitutionThemeProvider";

export const PRESET_UNIVERSITY_PALETTES = [
  { name: "Attendify Blue", color: "#0070f3" },
  { name: "Royal Navy (CJC / Ateneo)", color: "#1e40af" },
  { name: "Forest Emerald (DLSU)", color: "#15803d" },
  { name: "Crimson Red (UP)", color: "#991b1b" },
  { name: "Sunset Gold (UST)", color: "#d97706" },
  { name: "Imperial Purple", color: "#7c3aed" },
  { name: "Cyan Teal", color: "#0d9488" },
  { name: "Graphite Slate", color: "#334155" },
];

interface BrandCustomizerWithPreviewProps {
  value: string;
  onChange: (color: string) => void;
  institutionCode?: string;
  institutionName?: string;
}

export default function BrandCustomizerWithPreview({
  value,
  onChange,
  institutionCode = "CAMPUS",
  institutionName = "University Portal",
}: BrandCustomizerWithPreviewProps) {
  const activeColor = value || "#0070f3";

  // Compute derived tokens for live skeleton preview
  const previewTokens = useMemo(() => {
    const { r, g, b } = hexToRgb(activeColor);
    const contrastText = getContrastTextColor(activeColor);
    return {
      primary: activeColor,
      surface: `rgba(${r}, ${g}, ${b}, 0.12)`,
      glow: `rgba(${r}, ${g}, ${b}, 0.28)`,
      border: `rgba(${r}, ${g}, ${b}, 0.45)`,
      contrastText,
    };
  }, [activeColor]);

  // Evaluate WCAG AA contrast score
  const isAccessible = useMemo(() => {
    const { r, g, b } = hexToRgb(activeColor);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Suitable contrast against dark cards and text legibility
    return luminance > 0.12 && luminance < 0.90;
  }, [activeColor]);

  return (
    <Stack gap="sm">
      <div>
        <Group justify="space-between" align="center" mb={6}>
          <Text size="sm" fw={600} c="var(--text-primary)">
            Official Campus Brand Color
          </Text>
          <Badge
            size="xs"
            variant="light"
            color={isAccessible ? "teal" : "yellow"}
            leftSection={<IconShieldCheck size={12} />}
          >
            {isAccessible ? "WCAG AA Contrast Valid" : "Check Contrast"}
          </Badge>
        </Group>

        {/* Preset University Swatches */}
        <Group gap="xs" mb="xs" wrap="wrap">
          {PRESET_UNIVERSITY_PALETTES.map((palette) => {
            const isSelected = activeColor.toLowerCase() === palette.color.toLowerCase();
            return (
              <Tooltip key={palette.color} label={palette.name} position="top" withArrow>
                <button
                  type="button"
                  onClick={() => onChange(palette.color)}
                  className="btn-pressable"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    backgroundColor: palette.color,
                    border: isSelected ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.15)",
                    boxShadow: isSelected ? `0 0 10px ${palette.color}` : "none",
                    cursor: "pointer",
                    outline: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                  }}
                  aria-label={`Select ${palette.name}`}
                >
                  {isSelected && <IconCheck size={14} color="#ffffff" stroke={3} />}
                </button>
              </Tooltip>
            );
          })}
        </Group>

        {/* Full ColorInput with Popover Picker */}
        <ColorInput
          placeholder="#0070f3"
          value={activeColor}
          onChange={onChange}
          format="hex"
          size="sm"
          eyeDropperIcon={<IconSparkles size={16} />}
          styles={{
            input: {
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 500,
              letterSpacing: "0.5px",
            },
          }}
        />
      </div>

      {/* ─── Lightweight Wireframe Skeleton Preview Site ─── */}
      <Box
        style={{
          borderRadius: "10px",
          border: "1px solid var(--border-subtle)",
          backgroundColor: "var(--surface-0)",
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}
      >
        {/* Preview Frame Top Bar */}
        <Group
          justify="space-between"
          px="xs"
          py={6}
          style={{
            backgroundColor: "var(--surface-1)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <Group gap={6}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f56" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffbd2e" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27c93f" }} />
            <Text size="10px" c="dimmed" ml="xs" style={{ fontFamily: "monospace" }}>
              {institutionName} • attendify.app/{institutionCode.toLowerCase()}
            </Text>
          </Group>
          <Badge
            size="xs"
            variant="filled"
            style={{
              backgroundColor: previewTokens.surface,
              color: previewTokens.primary,
              border: `1px solid ${previewTokens.border}`,
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {institutionCode.slice(0, 4)}
          </Badge>
        </Group>

        {/* Mini Dashboard Layout (Sidebar + Content Wireframe) */}
        <div style={{ display: "flex", height: 160, padding: 8, gap: 8 }}>
          {/* Mini Sidebar */}
          <div
            style={{
              width: 55,
              backgroundColor: "var(--surface-1)",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              padding: "6px 4px",
              display: "flex",
              flexDirection: "column",
              gap: 5,
              flexShrink: 0,
            }}
          >
            {/* Logo Mark Highlight */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: previewTokens.surface,
                  border: `1px solid ${previewTokens.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: previewTokens.primary,
                }}
              >
                <IconScan size={8} stroke={3} />
              </div>
              <div style={{ height: 5, width: 22, backgroundColor: "var(--text-muted)", borderRadius: 2, opacity: 0.5 }} />
            </div>

            {/* Active Nav Item Highlight */}
            <div
              style={{
                height: 14,
                borderRadius: 4,
                backgroundColor: previewTokens.surface,
                borderLeft: `2px solid ${previewTokens.primary}`,
                display: "flex",
                alignItems: "center",
                paddingLeft: 4,
                transition: "all 160ms ease",
              }}
            >
              <div style={{ height: 4, width: 24, backgroundColor: previewTokens.primary, borderRadius: 2 }} />
            </div>

            {/* Muted Dummy Nav Items */}
            <div style={{ height: 12, borderRadius: 3, backgroundColor: "var(--surface-2)", margin: "0 2px" }} />
            <div style={{ height: 12, borderRadius: 3, backgroundColor: "var(--surface-2)", margin: "0 2px" }} />
          </div>

          {/* Mini Dashboard Main Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            {/* Header greeting skeleton */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ height: 7, width: 60, backgroundColor: "var(--text-primary)", borderRadius: 2, opacity: 0.8 }} />
                <div style={{ height: 5, width: 40, backgroundColor: "var(--text-muted)", borderRadius: 2, opacity: 0.5 }} />
              </div>
              {/* Pulsing Live Dot Highlight */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: previewTokens.primary,
                    boxShadow: `0 0 6px ${previewTokens.primary}`,
                  }}
                />
                <span style={{ fontSize: "8px", fontWeight: 600, color: previewTokens.primary }}>LIVE</span>
              </div>
            </div>

            {/* Micro Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, flex: 1 }}>
              {/* Clearance Hero Card Highlight */}
              <div
                style={{
                  backgroundColor: "var(--surface-1)",
                  borderRadius: 6,
                  border: `1px solid ${previewTokens.border}`,
                  boxShadow: `0 0 16px -4px ${previewTokens.glow}`,
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 160ms ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "8px", color: "var(--text-muted)", fontWeight: 500 }}>CLEARANCE</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: previewTokens.primary }}>88%</span>
                </div>
                {/* Radial / Bar Progress in Brand Color */}
                <div style={{ width: "100%", height: 4, backgroundColor: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: "88%", height: "100%", backgroundColor: previewTokens.primary, transition: "background-color 160ms ease" }} />
                </div>
              </div>

              {/* Primary Action Button Highlight */}
              <div
                style={{
                  backgroundColor: "var(--surface-1)",
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ height: 5, width: 45, backgroundColor: "var(--text-muted)", borderRadius: 2, opacity: 0.5 }} />
                <button
                  type="button"
                  style={{
                    width: "100%",
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: previewTokens.primary,
                    color: previewTokens.contrastText,
                    border: "none",
                    fontSize: "8px",
                    fontWeight: 700,
                    cursor: "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 8px ${previewTokens.glow}`,
                    transition: "all 160ms ease",
                  }}
                >
                  Check In
                </button>
              </div>
            </div>

            {/* Bottom Activity Row Skeleton */}
            <div
              style={{
                height: 20,
                backgroundColor: "var(--surface-1)",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 6px",
              }}
            >
              <div style={{ height: 4, width: 50, backgroundColor: "var(--surface-3)", borderRadius: 2 }} />
              <div
                style={{
                  height: 10,
                  padding: "0 4px",
                  borderRadius: 3,
                  backgroundColor: previewTokens.surface,
                  color: previewTokens.primary,
                  fontSize: "7px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                Face Scan OK
              </div>
            </div>
          </div>
        </div>
      </Box>
    </Stack>
  );
}
