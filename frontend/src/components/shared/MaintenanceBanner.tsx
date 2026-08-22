import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Alert, Group, Text, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { getSystemStatus } from "../../api/superAdmin";
import type { SystemStatus } from "../../api/superAdmin";
import { getTenantSlugFromHostname } from "../../utils/tenant";
import { useAuthStore } from "../../store/authStore";

export default function MaintenanceBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const location = useLocation();
  const { user } = useAuthStore();

  const fetchStatus = useCallback(() => {
    getSystemStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    window.addEventListener("system_status_updated", fetchStatus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("system_status_updated", fetchStatus);
    };
  }, [fetchStatus]);

  if (!status || (!status.maintenance_mode && !status.announcement)) {
    return null;
  }

  // Filter by target campus if scoped
  const target = (status.target_campus || "all").toLowerCase().trim();
  if (target !== "all") {
    const hostTenant = (getTenantSlugFromHostname() || "").toLowerCase();
    const pathParts = location.pathname.split("/").filter(Boolean);
    const firstSegment = pathParts[0]?.toLowerCase() || "";
    const userTenant = (user?.institution_code || "").toLowerCase();

    const isMatchingCampus =
      hostTenant === target || firstSegment === target || userTenant === target;

    if (!isMatchingCampus) {
      return null;
    }
  }

  const alertColor = status.banner_type || (status.maintenance_mode ? "orange" : "blue");

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 1000, width: "100%" }}>
      <Alert
        color={alertColor}
        radius={0}
        variant="filled"
        style={{ padding: "0.5rem 1.5rem" }}
      >
        <Group justify="center" gap="sm">
          <ThemeIcon color="transparent" size="sm">
            {status.maintenance_mode ? <IconAlertTriangle size={18} /> : <IconInfoCircle size={18} />}
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {status.maintenance_mode && "[System Maintenance] "}
            {status.announcement || "Scheduled system maintenance is currently in progress."}
          </Text>
        </Group>
      </Alert>
    </div>
  );
}
