import client from "./client";

export interface EmbeddingInfo {
  id: string;
  camera_angle: string | null;
  created_at: string;
}

export async function setConsent(
  attendeeId: string,
  consentGiven: boolean,
): Promise<void> {
  await client.post(`/registration/consent/${attendeeId}`, {
    consent_given: consentGiven,
    acknowledge_data_privacy: consentGiven,
  });
}

export async function uploadEmbedding(
  attendeeId: string,
  file: File,
  cameraAngle?: string,
): Promise<{ embedding_id: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (cameraAngle) {
    formData.append("camera_angle", cameraAngle);
  }
  const { data } = await client.post(
    `/registration/embeddings/${attendeeId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function getEmbeddings(
  attendeeId: string,
): Promise<EmbeddingInfo[]> {
  const { data } = await client.get<EmbeddingInfo[]>(
    `/registration/embeddings/${attendeeId}`,
  );
  return data;
}

export interface FaceInfo {
  bbox: [number, number, number, number];
  det_score: number;
  pose: [number, number, number];
  face_width: number;
  face_height: number;
  img_width: number;
  img_height: number;
}

export interface PreviewResult {
  face_detected: boolean;
  face_count: number;
  faces: FaceInfo[];
  quality_pass: boolean;
  hint: string;
}

export async function previewFrame(file: File): Promise<PreviewResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post<PreviewResult>(
    "/registration/preview",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export interface RegistrationStatus {
  is_registered: boolean;
  num_embeddings: number;
  can_register: boolean;
  last_registration: string | null;
}

export interface EmbeddingUploadResult {
  success: boolean;
  embedding_id: string;
  num_embeddings: number;
  message: string;
}

export interface EmbeddingDeleteResult {
  success: boolean;
  remaining_embeddings: number;
}

export interface RegistrationResetResult {
  success: boolean;
  status: string;
}

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const { data } = await client.get<RegistrationStatus>(
    "/attendees/me/registration/status",
  );
  return data;
}

export async function uploadMyEmbedding(
  file: File,
  imageAngle?: string,
): Promise<EmbeddingUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (imageAngle) {
    formData.append("image_angle", imageAngle);
  }
  const { data } = await client.post<EmbeddingUploadResult>(
    "/attendees/me/embeddings",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function deleteMyEmbedding(
  embeddingId: string,
): Promise<EmbeddingDeleteResult> {
  const { data } = await client.delete<EmbeddingDeleteResult>(
    `/attendees/me/embeddings/${embeddingId}`,
  );
  return data;
}

export async function resetMyRegistration(): Promise<RegistrationResetResult> {
  const { data } = await client.post<RegistrationResetResult>(
    "/attendees/me/registration/reset",
  );
  return data;
}
