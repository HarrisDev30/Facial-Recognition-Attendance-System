export interface InstitutionPublicResponse {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  is_active: boolean;
}

export interface InstitutionDetailResponse extends InstitutionPublicResponse {
  created_at: string;
}
