import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { env } from "@shared/lib/env";
import { ApiError, type ApiErrorResponse, type ApiResponse } from "./envelope";
import { codeToMessageKey } from "./codes";

type EnvelopeResponse<T = unknown> = AxiosResponse<ApiResponse<T>> & {
  __envelope: ApiResponse<T>;
};

/**
 * Single axios instance.
 * - withCredentials: true sends httpOnly cookies (auth strategy)
 * - response interceptor unwraps the {code, message, data} envelope
 * - 401 triggers a single silent refresh attempt
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
  // Gin binds repeated query params (?filters=a&filters=b) to []string.
  // axios default emits ?filters[]=a&filters[]=b which Gin ignores. Force
  // the un-bracketed form for compatibility across the API surface.
  paramsSerializer: { indexes: null },
});

let onUnauthenticated: (() => void) | null = null;
let getLocale: (() => string) | null = null;

export function configureAuthHandler(handler: () => void) {
  onUnauthenticated = handler;
}

export function configureLocaleResolver(resolver: () => string) {
  getLocale = resolver;
}

type SessionRequestConfig = InternalAxiosRequestConfig & {
  sessionGeneration?: number;
  skipSessionRefresh?: boolean;
  retryAfterProbe?: boolean;
};

let sessionGeneration = 0;
let refreshInFlight: Promise<boolean> | null = null;
let loggingOut = false;

export async function logoutSession() {
  loggingOut = true;
  await refreshInFlight?.catch(() => {});
  const logout = () => api.post("/auth/logout");
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("credchain-session-refresh", logout);
  }
  return logout();
}

api.interceptors.request.use((config: SessionRequestConfig) => {
  config.sessionGeneration = sessionGeneration;
  if (getLocale && config.headers) {
    config.headers["Accept-Language"] = getLocale();
  }
  return config;
});

function isSessionUnauthorized(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    (error.code === 200140 || error.code === 200141 || error.code === undefined)
  );
}

async function refreshSession(forceRotation = false): Promise<boolean> {
  if (!refreshInFlight) {
    const renew = async () => {
      await api.post("/auth/refresh");
      sessionGeneration++;
      return true;
    };
    const coordinate = async () => {
      if (typeof navigator !== "undefined" && navigator.locks) {
        return navigator.locks.request("credchain-session-refresh", async () => {
          if (forceRotation) return renew();
          // Another tab may have renewed the shared HttpOnly cookies while we waited.
          try {
            await api.get("/users/self", { skipSessionRefresh: true } as SessionRequestConfig);
            sessionGeneration++;
            return false;
          } catch (error) {
            if (!isSessionUnauthorized(error)) throw error;
            return renew();
          }
        });
      }
      return renew();
    };
    refreshInFlight = coordinate().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    if (response.config.url === "/auth/google") loggingOut = false;
    const envelope = response.data;
    if (envelope && typeof envelope === "object" && "code" in envelope) {
      (response as EnvelopeResponse).__envelope = envelope;
      response.data = ((envelope as { data?: unknown }).data ?? null) as never;
    }
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const fieldErrors = error.response?.data?.errors;
    const url = error.config?.url ?? "";

    // Rate limit handling
    if (status === 429) {
      const retryAfter = error.response?.headers?.["retry-after"];
      const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
      const messageKey =
        seconds && !isNaN(seconds) ? "system.rate_limited_with_retry" : "system.rate_limited";
      return Promise.reject(new ApiError(status, code, messageKey, error, fieldErrors));
    }

    const config = error.config as SessionRequestConfig | undefined;
    if (
      status === 401 &&
      (code === 200140 || code === 200141 || code === undefined) &&
      !url.includes("/auth/") &&
      config &&
      !config.skipSessionRefresh
    ) {
      const isReplay = config.headers?.["X-Retry"] === "1";
      if (loggingOut || (isReplay && !config.retryAfterProbe)) {
        onUnauthenticated?.();
      } else {
        try {
          if (isReplay || config.sessionGeneration === sessionGeneration) {
            config.retryAfterProbe = !(await refreshSession(isReplay));
          } else {
            config.retryAfterProbe = true;
          }
        } catch (refreshError) {
          // Network failures, rate limits and server outages do not invalidate a session.
          if (
            refreshError instanceof ApiError &&
            (refreshError.status === 401 || refreshError.code === 200343)
          ) {
            onUnauthenticated?.();
          }
          return Promise.reject(refreshError);
        }
        config.headers.set("X-Retry", "1");
        return api.request(config);
      }
    }

    return Promise.reject(new ApiError(status, code, codeToMessageKey(code), error, fieldErrors));
  },
);
