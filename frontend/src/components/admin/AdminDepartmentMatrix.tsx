import React from "react";
import {
  Paper,
  Text,
  Group,
  Badge,
  Progress,
} from "@mantine/core";
import {
  IconBuildingArch,
  IconAward,
} from "@tabler/icons-react";

interface DepartmentComplianceItem {
  name: string;
  code: string;
  totalStudents: number;
  attendanceRate: number;
}

interface AdminDepartmentMatrixProps {
  departments?: DepartmentComplianceItem[];
  loading?: boolean;
}

export const AdminDepartmentMatrix: React.FC<AdminDepartmentMatrixProps> = ({
  departments = [],
  loading: _loading = false,
}) => {

  return (
    <Paper className="admin-bento-card" p="md" radius="md">
      <div className="admin-card-header">
        <div className="admin-card-title-group">
          <Group gap="xs" align="center">
            <span className="admin-card-icon-badge text-teal">
              <IconBuildingArch size={16} />
            </span>
            <Text className="admin-card-heading">College Compliance Matrix</Text>
          </Group>
          <Text className="admin-card-subheading">
            Attendance compliance ranked by academic department
          </Text>
        </div>

        <Badge variant="light" color="teal" size="sm" leftSection={<IconAward size={12} />}>
          Benchmark: 80%
        </Badge>
      </div>

      <div className="department-matrix-list" style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {departments.length === 0 ? (
          <div style={{ padding: "20px 12px", textAlign: "center" }}>
            <Text fz="0.8125rem" c="dimmed">
              No academic departments registered yet. Enrolled student rosters will be aggregated here automatically by college.
            </Text>
          </div>
        ) : (
          departments.map((dept, index) => {
          const isTopTier = dept.attendanceRate >= 80;
          const isMidTier = dept.attendanceRate >= 75 && dept.attendanceRate < 80;
          const color = isTopTier ? "teal" : isMidTier ? "blue" : "orange";

          return (
            <div key={dept.code} className="department-matrix-row">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <Group gap={6}>
                  <Text fz="0.75rem" fw={700} c="dimmed" style={{ width: "16px", fontVariantNumeric: "tabular-nums" }}>
                    #{index + 1}
                  </Text>
                  <Text fz="0.8125rem" fw={600} c="var(--text-primary)">
                    {dept.name}
                  </Text>
                  <Badge size="xs" variant="outline" color="gray">
                    {dept.code}
                  </Badge>
                </Group>

                <Group gap="xs">
                  <Text fz="0.75rem" c="dimmed">
                    {dept.totalStudents} Enrolled
                  </Text>
                  <Text fz="0.8125rem" fw={700} c={color} style={{ fontVariantNumeric: "tabular-nums", width: "42px", textAlign: "right" }}>
                    {dept.attendanceRate}%
                  </Text>
                </Group>
              </div>

              {/* Progress track with 80% marker */}
              <div style={{ position: "relative", width: "100%" }}>
                <Progress
                  value={dept.attendanceRate}
                  color={color}
                  size="sm"
                  radius="xl"
                />
              </div>
            </div>
          );
        }))}
      </div>
    </Paper>
  );
};
