import axios from "axios";

export const AUTH_TOKEN_KEY = "intellidesk_access_token";

export const AUTH_UNAUTHORIZED_EVENT = "intellidesk:unauthorized";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",

  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem(AUTH_TOKEN_KEY);

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },

  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const statusCode = error.response?.status;

    const requestUrl = error.config?.url || "";

    const isLoginRequest = requestUrl.includes("/auth/login");

    const isRegisterRequest = requestUrl.includes("/auth/register");

    if (statusCode === 401 && !isLoginRequest && !isRegisterRequest) {
      localStorage.removeItem(AUTH_TOKEN_KEY);

      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  },
);

export default api;
