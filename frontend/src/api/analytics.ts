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

export async function getHourlyTrafficDistribution(days: number = 7): Promise<HourlyTrafficEntry[]> {
  const res = await client.get<HourlyTrafficEntry[]>("/api/analytics/institution/traffic-hourly", {
    params: { days },
  });
  return res.data;
}

export async function getVerificationBreakdown(): Promise<VerificationMethodMetric[]> {
  const res = await client.get<VerificationMethodMetric[]>("/api/analytics/institution/verification-breakdown");
  return res.data;
}

export async function getAtRiskStudents(thresholdPct: number = 75, limit: number = 20): Promise<AtRiskStudentEntry[]> {
  const res = await client.get<AtRiskStudentEntry[]>("/api/analytics/institution/at-risk", {
    params: { threshold_pct: thresholdPct, limit },
  });
  return res.data;
}
