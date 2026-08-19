import axios, { type AxiosError, type AxiosResponse } from "axios";
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

api.interceptors.request.use((config) => {
  if (getLocale && config.headers) {
    config.headers["Accept-Language"] = getLocale();
  }
  return config;
});

let refreshInFlight: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = api
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
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

    if (
      status === 401 &&
      !url.includes("/auth/refresh") &&
      !url.includes("/auth/google") &&
      !url.includes("/auth/logout") &&
      error.config &&
      error.config.headers?.["X-Retry"] !== "1"
    ) {
      try {
        await refreshSession();
        const retryConfig = { ...error.config };
        if (retryConfig.headers) {
          retryConfig.headers.set("X-Retry", "1");
        }
        return api.request(retryConfig);
      } catch {
        onUnauthenticated?.();
        return Promise.reject(
          new ApiError(status, code, codeToMessageKey(code), error, fieldErrors),
        );
      }
    }

    return Promise.reject(new ApiError(status, code, codeToMessageKey(code), error, fieldErrors));
  },
);
