import { cognitoAuth } from "../auth/cognito-auth.client";
import { getClientConfiguration } from "../config";

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) throw await apiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await cognitoAuth.getAccessToken();
  const configuration = getClientConfiguration();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  const response = await fetch(`${configuration.apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "omit",
    cache: "no-store",
  });
  if (response.status === 401) cognitoAuth.clearSession();
  return response;
}

export async function apiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (isErrorBody(body)) {
    const fields: FieldErrors = {};
    for (const issue of body.errors ?? []) fields[issue.field] = issue.messages;
    return new ApiError(
      body.message || "The request could not be completed.",
      response.status,
      fields,
    );
  }
  return new ApiError(
    "The request could not be completed. Please try again.",
    response.status,
  );
}

function isErrorBody(
  value: unknown,
): value is {
  message?: string;
  errors?: Array<{ field: string; messages: string[] }>;
} {
  return typeof value === "object" && value !== null;
}
