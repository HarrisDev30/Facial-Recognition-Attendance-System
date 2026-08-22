import axios from "axios";
import { handleSessionExpired } from "../utils/session";

// Default to local backend if VITE_API_URL is not set
const DEFAULT_API_URL = "http://localhost:8000";
const envUrl = import.meta.env.VITE_API_URL as string | undefined;
const targetUrl = (envUrl && envUrl.trim() !== "") ? envUrl.trim() : DEFAULT_API_URL;

const cleanUrl = targetUrl.replace(/\/+$/, "");

const client = axios.create({
  baseURL: cleanUrl,
  withCredentials: true,
});

// Normalize request URLs so they always prefix with /api
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.url && !config.url.startsWith("/api") && !config.url.startsWith("http")) {
    config.url = `/api${config.url.startsWith("/") ? "" : "/"}${config.url}`;
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
  baseURL: cleanUrl,
  withCredentials: true,
});

publicClient.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith("/api") && !config.url.startsWith("http")) {
    config.url = `/api${config.url.startsWith("/") ? "" : "/"}${config.url}`;
  }
  return config;
});
