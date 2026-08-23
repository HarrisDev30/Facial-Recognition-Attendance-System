import { Tooltip, useMantineColorScheme, useComputedColorScheme } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";

export default function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("dark", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";

  const toggle = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  return (
    <Tooltip
      label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      position="bottom"
      withArrow
      transitionProps={{ duration: 125, transition: "fade-down" }}
    >
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={toggle}
        title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
        aria-label="Toggle theme mode"
      >
        {isDark ? (
          <IconSun size={17} stroke={1.75} />
        ) : (
          <IconMoon size={17} stroke={1.75} />
        )}
      </button>
    </Tooltip>
  );
}
