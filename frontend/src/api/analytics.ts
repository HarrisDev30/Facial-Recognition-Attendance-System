import client from "./client";
import type {
  InstitutionSummaryMetrics,
  CollegeAttendanceBenchmark,
  HourlyTrafficEntry,
  VerificationMethodMetric,
  AtRiskStudentEntry,
} from "../types/analytics";

export async function getInstitutionSummary(): Promise<InstitutionSummaryMetrics> {
  const res = await client.get<InstitutionSummaryMetrics>("/api/analytics/institution/summary");
  return res.data;
}

export async function getCollegesComparison(): Promise<CollegeAttendanceBenchmark[]> {
  const res = await client.get<CollegeAttendanceBenchmark[]>("/api/analytics/institution/colleges-comparison");
  return res.data;
}

export async function getHourlyTrafficDistribution(
  days: number = 7,
  organization_id?: string,
): Promise<HourlyTrafficEntry[]> {
  const params: Record<string, any> = { days };
  if (organization_id) params.organization_id = organization_id;
  const res = await client.get<HourlyTrafficEntry[]>("/api/analytics/institution/traffic-hourly", {
    params,
  });
  return res.data;
}

export async function getVerificationBreakdown(
  organization_id?: string,
): Promise<VerificationMethodMetric[]> {
  const params: Record<string, any> = {};
  if (organization_id) params.organization_id = organization_id;
  const res = await client.get<VerificationMethodMetric[]>("/api/analytics/institution/verification-breakdown", {
    params,
  });
  return res.data;
}

export async function getAtRiskStudents(
  thresholdPct: number = 75,
  limit: number = 20,
  organization_id?: string,
): Promise<AtRiskStudentEntry[]> {
  const params: Record<string, any> = { threshold_pct: thresholdPct, limit };
  if (organization_id) params.organization_id = organization_id;
  const res = await client.get<AtRiskStudentEntry[]>("/api/analytics/institution/at-risk", {
    params,
  });
  return res.data;
}
