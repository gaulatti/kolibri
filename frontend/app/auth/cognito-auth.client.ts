import { COGNITO_SCOPES, getClientConfiguration } from "../config";

type TokenResponse = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type OAuthTransaction = {
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
};

type MemorySession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt: number;
};

export type AuthenticatedIdentity = {
  displayName: string;
  email?: string;
};

export type AuthSnapshot =
  | { status: "unauthenticated"; user: null }
  | { status: "authenticated"; user: AuthenticatedIdentity };

const TRANSACTION_KEY = "kolibri.oauth.transaction";
const MAX_TRANSACTION_AGE_MS = 10 * 60 * 1000;

class CognitoAuthClient {
  private session: MemorySession | null = null;
  private listeners = new Set<(snapshot: AuthSnapshot) => void>();

  snapshot(): AuthSnapshot {
    if (!this.session) return { status: "unauthenticated", user: null };
    return {
      status: "authenticated",
      user: this.identity(this.session.idToken),
    };
  }

  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn(returnTo = "/design-systems"): Promise<void> {
    await this.beginAuthorization(returnTo);
  }

  async restoreSession(returnTo: string): Promise<void> {
    await this.beginAuthorization(returnTo, true);
  }

  async completeCallback(url: URL): Promise<string> {
    const transaction = this.readTransaction();
    this.clearTransaction();
    const state = url.searchParams.get("state");
    if (!transaction || state !== transaction.state) {
      throw new Error(
        "The sign-in response could not be verified. Please try again.",
      );
    }
    if (Date.now() - transaction.createdAt > MAX_TRANSACTION_AGE_MS) {
      throw new Error("The sign-in request expired. Please try again.");
    }
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      this.clearSession();
      if (oauthError === "login_required")
        return `/sign-in?reason=session-expired&returnTo=${encodeURIComponent(
          safeReturnTo(transaction.returnTo),
        )}`;
      throw new Error("Cognito could not complete sign-in. Please try again.");
    }
    const code = url.searchParams.get("code");
    if (!code)
      throw new Error(
        "The sign-in response did not include an authorization code.",
      );

    const configuration = getClientConfiguration();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: configuration.cognitoClientId,
      redirect_uri: configuration.cognitoRedirectUri,
      code,
      code_verifier: transaction.verifier,
    });
    const response = await fetch(
      `${configuration.cognitoDomain}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (!response.ok)
      throw new Error(
        "Cognito could not establish a session. Please try again.",
      );
    this.setSession((await response.json()) as TokenResponse);
    return safeReturnTo(transaction.returnTo);
  }

  async getAccessToken(): Promise<string> {
    if (!this.session) throw new Error("Authentication is required");
    if (Date.now() < this.session.expiresAt - 30_000)
      return this.session.accessToken;
    if (!this.session.refreshToken) {
      this.clearSession();
      throw new Error("Your session expired");
    }
    await this.refresh();
    if (!this.session) throw new Error("Your session expired");
    return this.session.accessToken;
  }

  clearSession(): void {
    this.session = null;
    this.emit();
  }

  signOut(): void {
    this.clearTransaction();
    this.clearSession();
    const configuration = getClientConfiguration();
    const url = new URL("/logout", `${configuration.cognitoDomain}/`);
    url.searchParams.set("client_id", configuration.cognitoClientId);
    url.searchParams.set("logout_uri", configuration.cognitoLogoutUri);
    window.location.assign(url);
  }

  private async beginAuthorization(
    returnTo: string,
    silent = false,
  ): Promise<void> {
    const configuration = getClientConfiguration();
    const verifier = randomBase64Url(64);
    const state = randomBase64Url(32);
    const challenge = await sha256Base64Url(verifier);
    const transaction: OAuthTransaction = {
      state,
      verifier,
      returnTo: safeReturnTo(returnTo),
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify(transaction));

    const url = new URL("/oauth2/authorize", `${configuration.cognitoDomain}/`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", configuration.cognitoClientId);
    url.searchParams.set("redirect_uri", configuration.cognitoRedirectUri);
    url.searchParams.set("scope", COGNITO_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (silent) {
      url.searchParams.set("prompt", "none");
    } else {
      url.searchParams.set("identity_provider", "Google");
      url.searchParams.set("prompt", "select_account");
    }
    window.location.assign(url);
  }

  private async refresh(): Promise<void> {
    const refreshToken = this.session?.refreshToken;
    const idToken = this.session?.idToken;
    if (!refreshToken) throw new Error("Your session expired");
    const configuration = getClientConfiguration();
    const response = await fetch(
      `${configuration.cognitoDomain}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: configuration.cognitoClientId,
          refresh_token: refreshToken,
        }),
      },
    );
    if (!response.ok) {
      this.clearSession();
      throw new Error("Your session expired");
    }
    this.setSession(
      (await response.json()) as TokenResponse,
      refreshToken,
      idToken,
    );
  }

  private setSession(
    tokens: TokenResponse,
    existingRefreshToken?: string,
    existingIdToken?: string,
  ): void {
    if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) {
      throw new Error("Cognito returned an invalid session");
    }
    this.session = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token || existingIdToken,
      refreshToken: tokens.refresh_token || existingRefreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
    this.emit();
  }

  private readTransaction(): OAuthTransaction | null {
    const value = window.sessionStorage.getItem(TRANSACTION_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as OAuthTransaction;
    } catch {
      return null;
    }
  }

  private clearTransaction(): void {
    window.sessionStorage.removeItem(TRANSACTION_KEY);
  }

  private identity(idToken?: string): AuthenticatedIdentity {
    const claims = idToken ? decodeJwtPayload(idToken) : {};
    const email = typeof claims.email === "string" ? claims.email : undefined;
    const name = typeof claims.name === "string" ? claims.name : undefined;
    return { displayName: name || email || "kolibri user", email };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function safeReturnTo(value: string): string {
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/design-systems";
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(`${normalized}${padding}`)) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

export const cognitoAuth = new CognitoAuthClient();
