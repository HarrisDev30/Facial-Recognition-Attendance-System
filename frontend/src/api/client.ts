import axios from "axios";
import { handleSessionExpired } from "../utils/session";

const DEFAULT_API_URL = "https://silver-spork-jrj976w6xwggf799-8000.app.github.dev";
const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_API_URL;

let baseURL = "/api";
if (rawApiUrl) {
  const cleanUrl = rawApiUrl.replace(/\/+$/, "");
  baseURL = cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
}

const client = axios.create({
  baseURL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      localStorage.removeItem("token");
      handleSessionExpired();
    }
    return Promise.reject(err);
  },
);

export default client;

export const publicClient = axios.create({
  baseURL,
});
