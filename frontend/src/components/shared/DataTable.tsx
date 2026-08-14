import type { ReactNode } from "react";
import { LoadingOverlay, Table, Pagination, Group, ScrollArea, Text, Stack, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import EmptyState from "../EmptyState";

interface Column {
  key: string;
  label: string;
  render?: (row: any) => ReactNode;
}

interface DataTableProps {
  columns: Column[];
  rows: any[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: any) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

export default function DataTable({
  columns,
  rows,
  loading = false,
  emptyMessage = "No data",
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onRowClick,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
}: DataTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const showSearch = typeof searchQuery === "string" && typeof onSearchChange === "function";

  return (
    <div style={{ position: "relative" }}>
      <LoadingOverlay visible={loading} />

      {showSearch && (
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          leftSectionPointerEvents="none"
          leftSectionWidth={36}
          styles={{ input: { paddingLeft: "2.5rem" } }}
          value={searchQuery}
          onChange={(e) => onSearchChange!(e.currentTarget.value)}
          mb="sm"
        />
      )}

      {!loading && rows.length === 0 ? (
        <EmptyState title={emptyMessage} />
      ) : isMobile ? (
        <Stack gap="xs">
          {rows.map((row, i) => (
            <div
              key={row.id ?? i}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? "pointer" : undefined,
                background: i % 2 === 0 ? "var(--surface-1)" : undefined,
                borderRadius: "var(--mantine-radius-sm)",
                padding: "var(--mantine-spacing-xs) var(--mantine-spacing-sm)",
              }}
            >
              {columns.map((col) => (
                <Group key={col.key} justify="space-between" py={2} wrap="nowrap">
                  <Text size="sm" c="dimmed" style={{ minWidth: 90 }}>
                    {col.label}
                  </Text>
                  <Text size="sm" style={{ flex: 1, textAlign: "right" }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </Text>
                </Group>
              ))}
            </div>
          ))}
        </Stack>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th key={col.key}>{col.label}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, i) => (
                <Table.Tr
                  key={row.id ?? i}
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? "pointer" : undefined }}
                >
                  {columns.map((col) => (
                    <Table.Td key={col.key}>
                      {col.render ? col.render(row) : row[col.key]}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {totalPages > 1 && (
        <Group justify="center" py="sm">
          <Pagination total={totalPages} value={page} onChange={onPageChange} />
        </Group>
      )}
    </div>
  );
}
