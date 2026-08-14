import { useState, useMemo, useCallback } from "react";

interface UsePaginationReturn {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
  setTotal: (total: number) => void;
  totalPages: number;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export function usePagination(
  initialPage = 1,
  initialPageSize = 20,
): UsePaginationReturn {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.ceil(total / pageSize), [total, pageSize]);

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(p - 1, 1));
  }, []);

  const reset = useCallback(() => {
    setPage(initialPage);
    setTotal(0);
  }, [initialPage]);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    setTotal,
    totalPages,
    nextPage,
    prevPage,
    reset,
  };
}
