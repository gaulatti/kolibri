export type ClientConfiguration = {
  apiBaseUrl: string;
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoRedirectUri: string;
  cognitoLogoutUri: string;
};

export const COGNITO_SCOPES = "openid email profile";

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing frontend configuration: ${name}`);
  return normalized;
}

function absoluteUrl(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }
  return url.toString().replace(/\/$/, "");
}

export function getClientConfiguration(): ClientConfiguration {
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  return {
    apiBaseUrl: absoluteUrl(
      "VITE_API_BASE_URL",
      required("VITE_API_BASE_URL", import.meta.env.VITE_API_BASE_URL),
    ),
    cognitoDomain: absoluteUrl(
      "VITE_COGNITO_DOMAIN",
      required("VITE_COGNITO_DOMAIN", import.meta.env.VITE_COGNITO_DOMAIN),
    ),
    cognitoClientId: required(
      "VITE_COGNITO_CLIENT_ID",
      import.meta.env.VITE_COGNITO_CLIENT_ID,
    ),
    cognitoRedirectUri: absoluteUrl(
      "frontend callback URI",
      `${origin}/auth/callback`,
    ),
    cognitoLogoutUri: absoluteUrl(
      "frontend logout URI",
      `${origin}/sign-in?signedOut=1`,
    ),
  };
}
