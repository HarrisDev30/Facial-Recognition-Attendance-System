import client from "./client";
import type {
  AdminRegisterRequest,
  AdminUserResponse,
  LoginRequest,
  RegisterAttendeeRequest,
  TokenResponse,
  UserProfileResponse,
} from "../types/auth";

export async function login(body: LoginRequest): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/auth/login", body);
  return data;
}

export async function registerStudent(
  body: RegisterAttendeeRequest,
): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/auth/register/student", body);
  return data;
}

export async function registerStaff(
  body: RegisterAttendeeRequest,
): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/auth/register/staff", body);
  return data;
}

export async function register(
  body: AdminRegisterRequest,
): Promise<AdminUserResponse> {
  const { data } = await client.post<AdminUserResponse>("/auth/register", body);
  return data;
}

export async function getMe(): Promise<UserProfileResponse> {
  const { data } = await client.get<UserProfileResponse>("/auth/me");
  return data;
}
