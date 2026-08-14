import axios from "axios";
import { handleSessionExpired } from "../utils/session";

const DEFAULT_API_URL = "https://silver-spork-jrj976w6xwggf799-8000.app.github.dev";
const envUrl = import.meta.env.VITE_API_URL as string | undefined;
const targetUrl = (envUrl && envUrl.trim() !== "") ? envUrl.trim() : DEFAULT_API_URL;

const cleanUrl = targetUrl.replace(/\/+$/, "");
const baseURL = cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;

const client = axios.create({
  baseURL,
  withCredentials: true,
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
  withCredentials: true,
});
