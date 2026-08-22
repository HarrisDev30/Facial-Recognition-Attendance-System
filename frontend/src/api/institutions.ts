import client from "./client";
import type { InstitutionPublicResponse, InstitutionDetailResponse } from "../types/institution";

export async function getInstitutions(activeOnly: boolean = true): Promise<InstitutionPublicResponse[]> {
  const res = await client.get<InstitutionPublicResponse[]>("/api/institutions", {
    params: { active_only: activeOnly },
  });
  return res.data;
}

export async function getInstitutionBySlug(slug: string): Promise<InstitutionPublicResponse> {
  const res = await client.get<InstitutionPublicResponse>(`/api/institutions/by-slug/${slug}`);
  return res.data;
}

export async function getInstitutionById(id: string): Promise<InstitutionDetailResponse> {
  const res = await client.get<InstitutionDetailResponse>(`/api/institutions/${id}`);
  return res.data;
}
