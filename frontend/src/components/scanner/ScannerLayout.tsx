import { AppShell } from "@mantine/core";
import { Outlet } from "react-router-dom";

export default function ScannerLayout() {
  return (
    <AppShell padding={0}>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
