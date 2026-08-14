import { publicClient } from "./client";
import type { DepartmentListResponse } from "../types/auth";

export async function getDepartments(): Promise<DepartmentListResponse> {
  const { data } = await publicClient.get<DepartmentListResponse>("/departments");
  return data;
}
