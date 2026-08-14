import axios from "axios";
import { handleSessionExpired } from "../utils/session";

const client = axios.create({
  baseURL: "/api",
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
  baseURL: "/api",
});
