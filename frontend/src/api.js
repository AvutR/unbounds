import axios from "axios";
const API = import.meta.env.VITE_API_URL || "http://localhost:10000";

export function apiClient(apiKey) {
  return axios.create({
    baseURL: API,
    headers: { "x-api-key": apiKey }
  });
}
