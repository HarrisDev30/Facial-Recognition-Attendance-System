import axios from "axios";
import client from "./client";
import { handleSessionExpired } from "../utils/session";
import type {
  AdminRegisterRequest,
  AdminUserResponse,
  LoginRequest,
  RegisterAttendeeRequest,
  TokenResponse,
  UserProfileResponse,
} from "../types/auth";

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

let authBaseURL = "/api/auth";
if (rawApiUrl) {
  const cleanUrl = rawApiUrl.replace(/\/+$/, "");
  const base = cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
  authBaseURL = `${base}/auth`;
}

const authClient = axios.create({
  baseURL: authBaseURL,
});

authClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      axios.isAxiosError(err) &&
      err.response?.status === 401 &&
      err.config?.headers?.Authorization
    ) {
      localStorage.removeItem("token");
      handleSessionExpired();
    }
    return Promise.reject(err);
  },
);

export async function login(body: LoginRequest): Promise<TokenResponse> {
  const { data } = await authClient.post<TokenResponse>("/login", body);
  return data;
}

export async function registerStudent(
  body: RegisterAttendeeRequest,
): Promise<{ success: boolean; user_id: string; message: string }> {
  const { data } = await authClient.post<{
    success: boolean;
    user_id: string;
    message: string;
  }>("/register/student", body);
  return data;
}

export async function registerStaff(
  body: RegisterAttendeeRequest,
): Promise<{ success: boolean; user_id: string; message: string }> {
  const { data } = await authClient.post<{
    success: boolean;
    user_id: string;
    message: string;
  }>("/register/staff", body);
  return data;
}

export async function register(
  body: AdminRegisterRequest,
): Promise<AdminUserResponse> {
  const { data } = await client.post<AdminUserResponse>("/register", body);
  return data;
}

export async function getMe(): Promise<UserProfileResponse> {
  const { data } = await client.get<UserProfileResponse>("/auth/me");
  return data;
}
