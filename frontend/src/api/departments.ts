import client from "./client";
import type { DepartmentListResponse } from "../types/auth";

export async function getDepartments(params?: {
  institution_id?: string;
  institution_slug?: string;
  org_type?: string;
}): Promise<DepartmentListResponse> {
  const { data } = await client.get<DepartmentListResponse>("/departments", {
    params,
  });
  return data;
}
