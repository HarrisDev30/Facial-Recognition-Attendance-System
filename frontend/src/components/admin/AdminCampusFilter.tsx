import React from "react";
import { Group, Badge, UnstyledButton, Text } from "@mantine/core";
import { IconBuildingArch, IconCheck } from "@tabler/icons-react";

export interface DepartmentFilterItem {
  id: string;
  name: string;
  code: string;
  count: number;
}

interface AdminCampusFilterProps {
  departments: DepartmentFilterItem[];
  selectedDepartmentId: string | null;
  onSelectDepartment: (deptId: string | null) => void;
  totalAttendeesCount: number;
}

export const AdminCampusFilter: React.FC<AdminCampusFilterProps> = ({
  departments,
  selectedDepartmentId,
  onSelectDepartment,
  totalAttendeesCount,
}) => {
  return (
    <div className="campus-filter-container" style={{ marginBottom: "16px" }}>
      <Group gap="xs" wrap="wrap" align="center">
        <Group gap={6} mr="xs">
          <IconBuildingArch size={15} style={{ opacity: 0.7, color: "var(--brand-primary)" }} />
          <Text fz="0.75rem" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
            College Scope:
          </Text>
        </Group>

        {/* All Departments Chip */}
        <UnstyledButton
          onClick={() => onSelectDepartment(null)}
          className={`campus-filter-pill ${selectedDepartmentId === null ? "active" : ""}`}
        >
          {selectedDepartmentId === null && <IconCheck size={12} style={{ marginRight: 4 }} />}
          <span>All Colleges</span>
          <Badge size="xs" variant={selectedDepartmentId === null ? "filled" : "light"} color={selectedDepartmentId === null ? "teal" : "gray"}>
            {totalAttendeesCount}
          </Badge>
        </UnstyledButton>

        {/* Individual Department Chips */}
        {departments.map((dept) => {
          const isSelected = selectedDepartmentId === dept.name || selectedDepartmentId === dept.id;
          return (
            <UnstyledButton
              key={dept.id || dept.code}
              onClick={() => onSelectDepartment(isSelected ? null : dept.name)}
              className={`campus-filter-pill ${isSelected ? "active" : ""}`}
            >
              {isSelected && <IconCheck size={12} style={{ marginRight: 4 }} />}
              <span>{dept.code}</span>
              <Badge
                size="xs"
                variant={isSelected ? "filled" : "light"}
                color={isSelected ? "teal" : "gray"}
              >
                {dept.count}
              </Badge>
            </UnstyledButton>
          );
        })}
      </Group>
    </div>
  );
};
