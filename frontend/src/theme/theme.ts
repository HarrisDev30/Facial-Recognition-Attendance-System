import type { MantineThemeOverride } from "@mantine/core";

const surface0 = "#050505";
const surface1 = "#111111";
const surface2 = "#171717";
const surface3 = "#1a1a1a";
const textPrimary = "#ededed";
const textSecondary = "#888888";
const textMuted = "#666666";
const borderSubtle = "#2a2a2a";
const borderStrong = "#3a3a3a";
const link = "#3b82f6";
const error = "#ff4444";
const warning = "#f5a623";

const shadowXs = "0 0 0 1px rgba(0,0,0,0.4)";
const shadowSm = "0 0 0 1px rgba(0,0,0,0.4), 0px 1px 1px rgba(0,0,0,0.2), 0px 2px 2px rgba(0,0,0,0.3)";
const shadowMd = "0px 1px 1px rgba(0,0,0,0.2), 0px 2px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.4)";
const shadowLg = "0px 2px 2px rgba(0,0,0,0.3), 0px 8px 8px -8px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.4)";
const shadowXl = "0px 2px 2px rgba(0,0,0,0.3), 0px 8px 16px -4px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.4)";
const shadow2xl = "0px 1px 1px rgba(0,0,0,0.2), 0px 8px 16px -4px rgba(0,0,0,0.3), 0px 24px 32px -8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.4)";

export const theme: MantineThemeOverride = {
  primaryColor: "primary",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",

  colors: {
    primary: [
      textPrimary, "#dddddd", "#cdcdcd", "#bbbbbb", "#aaaaaa",
      "#999999", "#888888", "#666666", "#444444", surface2,
    ],
    surface: [
      surface0, "#0d0d0d", "#101010", surface1, "#141414",
      surface2, surface3, "#1e1e1e", "#222222", borderSubtle,
    ],
    body: [
      surface0, "#0d0d0d", "#141414", surface1, "#181818",
      "#333333", "#555555", "#777777", textSecondary, textMuted,
    ],
    link: [
      "#0d1b2a", "#112240", "#1a3a5c", "#1e4d8c", "#2563eb",
      link, "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe",
    ],
    success: [
      "#052e16", "#064e24", "#0f6925", "#15803d", "#16a34a",
      "#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7",
    ],
    error: [
      "#2e0505", "#4e0606", "#690f0f", "#801515", error,
      "#ff6666", "#ff8888", "#ffaaaa", "#ffcccc", "#ffdddd",
    ],
    warning: [
      "#1a0e00", "#331a00", "#4d2500", "#663300", "#804000",
      warning, "#f5b340", "#f7c264", "#fad188", "#fce0b3",
    ],
    violet: [
      "#0d0520", "#1a0833", "#260d4d", "#331166", "#4c1d95",
      "#7c3aed", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe",
    ],
    cyan: [
      "#042424", "#083344", "#0f4c5c", "#155e75", "#0891b2",
      "#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc", "#cffafe",
    ],
    pink: [
      "#2a0515", "#4a0a26", "#6b0a34", "#8c0a47", "#be185d",
      "#ec4899", "#f472b6", "#f9a8d4", "#fce7f3", "#fdf2f8",
    ],
    orange: [
      "#1a0800", "#331000", "#4d1800", "#662000", "#802800",
      "#e65100", "#f97316", "#fb923c", "#fdba74", "#fed7aa",
    ],
    gray: [
      "#0a0a0a", "#111111", "#1a1a1a", "#222222", "#2a2a2a",
      "#555555", "#777777", "#999999", "#bbbbbb", "#dddddd",
    ],
  },

  fontSizes: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "48px",
  },

  lineHeights: {
    xs: "1.33",
    sm: "1.43",
    md: "1.5",
    lg: "1.56",
    xl: "1.4",
    "2xl": "1.33",
    "3xl": "1.25",
    "4xl": "1.0",
  },

  headings: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    sizes: {
      h1: {
        fontSize: "48px",
        fontWeight: "600",
        lineHeight: "48px",
        letterSpacing: "-2.4px",
      } as { fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string },
      h2: {
        fontSize: "32px",
        fontWeight: "600",
        lineHeight: "40px",
        letterSpacing: "-1.28px",
      } as { fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string },
      h3: {
        fontSize: "24px",
        fontWeight: "600",
        lineHeight: "32px",
        letterSpacing: "-0.96px",
      } as { fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string },
      h4: {
        fontSize: "20px",
        fontWeight: "600",
        lineHeight: "28px",
        letterSpacing: "-0.6px",
      } as { fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string },
      h5: {
        fontSize: "16px",
        fontWeight: "500",
        lineHeight: "24px",
      },
      h6: {
        fontSize: "14px",
        fontWeight: "500",
        lineHeight: "20px",
      },
    },
  },

  spacing: {
    xxs: "4px",
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "40px",
    "3xl": "48px",
    "4xl": "64px",
    "5xl": "96px",
    "6xl": "128px",
    section: "192px",
  },

  radius: {
    none: "0px",
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "pill-sm": "64px",
    pill: "100px",
    full: "9999px",
  },

  shadows: {
    xs: shadowXs,
    sm: shadowSm,
    md: shadowMd,
    lg: shadowLg,
    xl: shadowXl,
    "2xl": shadow2xl,
  },

  defaultRadius: "sm",

  other: {
    shadowXs,
    shadowSm,
    shadowMd,
    shadowLg,
    shadowXl,
    shadow2xl,
    sidebarBg: "var(--sidebar-bg)",
    sidebarText: "var(--sidebar-text)",
    sidebarTextMuted: "var(--sidebar-text-muted)",
    sidebarHover: "var(--sidebar-hover)",
    sidebarActive: "var(--sidebar-active)",
  },

  components: {
    Button: {
      defaultProps: {
        radius: "pill",
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: "background-color 0.1s ease, transform 0.1s ease, box-shadow 0.1s ease",
        },
      },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: surface2,
          color: textPrimary,
          borderColor: borderSubtle,
        },
      },
    },
    Input: {
      defaultProps: {
        radius: "sm",
      },
      styles: {
        input: {
          height: "40px",
          padding: "0 12px",
          fontSize: "14px",
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surface2,
          color: textPrimary,
          "&:focus": {
            borderColor: textSecondary,
          },
        },
      },
    },
    InputWrapper: {
      styles: {
        label: {
          fontSize: "14px",
          fontWeight: 500,
          color: textSecondary,
          marginBottom: "8px",
        },
      },
    },
    PasswordInput: {
      styles: {
        innerInput: {
          height: "40px",
          padding: "0 12px",
          fontSize: "14px",
        },
      },
    },
    Select: {
      styles: {
        input: {
          height: "40px",
          padding: "0 12px",
          fontSize: "14px",
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surface2,
          color: textPrimary,
        },
        dropdown: {
          backgroundColor: surface2,
          borderColor: borderSubtle,
        },
        option: {
          color: textPrimary,
          "&:hover": {
            backgroundColor: surface3,
          },
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          height: "40px",
          padding: "0 12px",
          fontSize: "14px",
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surface2,
          color: textPrimary,
          "&:focus": {
            borderColor: textSecondary,
          },
        },
      },
    },
    NumberInput: {
      styles: {
        input: {
          height: "40px",
          padding: "0 12px",
          fontSize: "14px",
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surface2,
          color: textPrimary,
          "&:focus": {
            borderColor: textSecondary,
          },
        },
      },
    },
    Table: {
      styles: {
        table: {
          fontSize: "14px",
        },
        thead: {
          backgroundColor: surface1,
          "& th": {
            fontSize: "12px",
            fontWeight: 400,
            fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: textSecondary,
            padding: "8px 12px",
            borderBottom: `1px solid ${borderSubtle}`,
          },
        },
        tbody: {
          "& tr": {
            borderBottom: `1px solid ${borderSubtle}`,
          },
          "& tr:nth-of-type(even)": {
            backgroundColor: "rgba(255,255,255,0.02)",
          },
          "& td": {
            padding: "8px 12px",
            color: textPrimary,
          },
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
      styles: {
        root: {
          backgroundColor: surface1,
          color: textSecondary,
          fontSize: "12px",
          fontWeight: 400,
          lineHeight: "16px",
          padding: "0 8px",
          textTransform: "none",
          letterSpacing: "0px",
          border: "none",
        },
      },
    },
    Card: {
      defaultProps: {
        withBorder: true,
        padding: "lg",
        radius: "md",
      },
      styles: {
        root: {
          backgroundColor: surface2,
          color: textPrimary,
          borderColor: borderSubtle,
          boxShadow: shadowMd,
        },
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        padding: "xl",
      },
      styles: {
        header: {
          backgroundColor: surface2,
          borderBottom: `1px solid ${borderSubtle}`,
          padding: "24px 32px",
          marginBottom: 0,
        },
        title: {
          fontSize: "20px",
          fontWeight: 600,
          lineHeight: "28px",
          letterSpacing: "-0.6px",
          color: textPrimary,
        },
        body: {
          padding: "24px 32px",
          backgroundColor: surface2,
        },
        content: {
          backgroundColor: surface2,
          boxShadow: shadow2xl,
        },
        close: {
          color: textSecondary,
        },
      },
    },
    Tabs: {
      styles: {
        list: {
          padding: "4px 0",
          gap: "4px",
          flexWrap: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
        panel: {
          paddingTop: "16px",
        },
        tab: {
          borderRadius: "64px",
          padding: "0 12px",
          height: "32px",
          fontSize: "14px",
          fontWeight: 400,
          color: textSecondary,
          backgroundColor: "transparent",
          "&[data-active]": {
            color: textPrimary,
            backgroundColor: surface3,
            fontWeight: 500,
          },
          "&:hover": {
            backgroundColor: surface3,
          },
        },
        tabLabel: {
          fontSize: "14px",
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          borderRadius: "6px",
          padding: "8px 12px",
          backgroundColor: "transparent",
          color: "var(--sidebar-text)",
          "&:hover": {
            backgroundColor: "var(--sidebar-hover)",
            color: "var(--sidebar-text)",
          },
          "&[data-active]": {
            backgroundColor: "var(--sidebar-active)",
            color: "var(--sidebar-text)",
            borderLeft: "3px solid var(--sidebar-text)",
          },
        },
        body: {
          backgroundColor: "transparent",
        },
        label: {
          fontSize: "14px",
          color: "inherit",
        },
        description: {
          fontSize: "12px",
          color: "var(--sidebar-text-muted)",
        },
      },
    },
    Pagination: {
      styles: {
        control: {
          borderRadius: "6px",
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surface2,
          color: textPrimary,
          "&[data-active]": {
            backgroundColor: textPrimary,
            color: surface0,
            borderColor: textPrimary,
          },
        },
      },
    },
    Alert: {
      styles: {
        root: {
          borderRadius: "6px",
          padding: "12px 16px",
          backgroundColor: surface2,
          borderColor: borderSubtle,
        },
        message: {
          fontSize: "14px",
        },
      },
    },
    Notification: {
      styles: {
        root: {
          borderRadius: "8px",
          backgroundColor: surface2,
          border: `1px solid ${borderSubtle}`,
          boxShadow: shadowLg,
        },
      },
    },
    Tooltip: {
      styles: {
        tooltip: {
          backgroundColor: textPrimary,
          color: surface0,
          fontSize: "12px",
          padding: "4px 8px",
          borderRadius: "4px",
        },
      },
    },
    Switch: {
      styles: {
        track: {
          cursor: "pointer",
          backgroundColor: borderSubtle,
          borderColor: borderStrong,
        },
      },
    },
    Stepper: {
      styles: {
        stepIcon: {
          borderColor: borderSubtle,
          color: textSecondary,
          "&[data-progress]": {
            borderColor: textPrimary,
            backgroundColor: textPrimary,
            color: surface0,
          },
          "&[data-completed]": {
            backgroundColor: textPrimary,
            borderColor: textPrimary,
          },
        },
        stepLabel: {
          fontSize: "14px",
          fontWeight: 500,
          color: textPrimary,
        },
        stepDescription: {
          fontSize: "12px",
          color: textMuted,
        },
        separator: {
          backgroundColor: borderSubtle,
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        variant: "subtle",
      },
      styles: {
        root: {
          borderRadius: "9999px",
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surface2,
          color: textPrimary,
          "&:hover": {
            backgroundColor: surface3,
          },
        },
      },
    },
    Progress: {
      styles: {
        root: {
          backgroundColor: surface3,
        },
      },
    },
    Loader: {
      styles: {
        root: {
          "--loader-color": textPrimary,
        },
      },
    },
    AppShell: {
      styles: {
        header: {
          backgroundColor: surface0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        },
        navbar: {
          backgroundColor: "var(--sidebar-bg)",
          borderRight: "1px solid rgba(255,255,255,0.1)",
        },
        main: {
          backgroundColor: surface0,
        },
      },
    },
    Divider: {
      styles: {
        root: {
          borderTopColor: borderSubtle,
        },
      },
    },
    Menu: {
      styles: {
        dropdown: {
          backgroundColor: surface2,
          border: `1px solid ${borderSubtle}`,
          boxShadow: shadowLg,
        },
        item: {
          fontSize: "14px",
          color: textSecondary,
          "&:hover": {
            backgroundColor: surface3,
            color: textPrimary,
          },
        },
        itemLabel: {
          fontSize: "14px",
        },
      },
    },
    Avatar: {
      defaultProps: {
        radius: "xl",
        color: "ink",
      },
    },
    Breadcrumbs: {
      styles: {
        separator: {
          color: textMuted,
          fontSize: "14px",
        },
        breadcrumb: {
          fontSize: "14px",
          color: textSecondary,
        },
      },
    },
    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: surface1,
          borderRadius: "64px",
        },
        indicator: {
          backgroundColor: textPrimary,
          borderRadius: "64px",
        },
        label: {
          fontSize: "14px",
          fontWeight: 400,
          color: textSecondary,
          padding: "0 16px",
          "&[data-active]": {
            color: surface0,
            fontWeight: 500,
          },
        },
        control: {
          "&::before": {
            display: "none",
          },
        },
      },
    },
    Slider: {
      styles: {
        track: {
          backgroundColor: surface3,
          height: "4px",
        },
        bar: {
          backgroundColor: textPrimary,
        },
        thumb: {
          backgroundColor: textPrimary,
          border: "none",
          width: "16px",
          height: "16px",
        },
      },
    },
    Checkbox: {
      styles: {
        input: {
          cursor: "pointer",
          borderColor: borderStrong,
          "&:checked": {
            backgroundColor: textPrimary,
            borderColor: textPrimary,
          },
        },
        label: {
          cursor: "pointer",
          fontSize: "14px",
          color: textSecondary,
        },
      },
    },
    Anchor: {
      defaultProps: {
        underline: "hover",
      },
      styles: {
        root: {
          fontSize: "16px",
          fontWeight: 400,
          color: link,
        },
      },
    },
  },
};
