import {
  Button,
  Card,
  DashboardGrid,
  DashboardSection,
  ErrorState,
  Field,
  Input,
  StatusBadge,
} from "~/bleecker";
import { useEffect, useState } from "react";
import validateNpmPackageName from "validate-npm-package-name";
import { ApiError, type FieldErrors } from "../api/api-client";
import {
  designSystemsApi,
  type RuntimeConfiguration,
  type RuntimeConfigurationInput,
} from "../api/design-systems";
import { LoadingState } from "../components/loading-state";

const DEFAULT_SETTINGS: RuntimeConfigurationInput = {
  figmaFileKey: "",
  packageName: "",
};

export function RuntimeConfigurationForm({
  designSystemId,
  view,
}: {
  designSystemId: string;
  view: "configuration" | "credentials";
}) {
  const [configuration, setConfiguration] =
    useState<RuntimeConfiguration | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [figmaCredential, setFigmaCredential] = useState("");
  const [npmCredential, setNpmCredential] = useState("");
  const [settingsErrors, setSettingsErrors] = useState<FieldErrors>({});
  const [figmaCredentialError, setFigmaCredentialError] = useState<
    string | null
  >(null);
  const [npmCredentialError, setNpmCredentialError] = useState<string | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [figmaCredentialSaved, setFigmaCredentialSaved] = useState(false);
  const [npmCredentialSaved, setNpmCredentialSaved] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [figmaCredentialPending, setFigmaCredentialPending] = useState(false);
  const [npmCredentialPending, setNpmCredentialPending] = useState(false);

  useEffect(() => {
    let active = true;
    designSystemsApi
      .getRuntimeConfiguration(designSystemId)
      .then((result) => {
        if (!active) return;
        setConfiguration(result);
        setSettings({
          figmaFileKey: result.figmaFileKey ?? "",
          packageName: result.packageName ?? "",
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadError(
          cause instanceof ApiError
            ? cause.message
            : "Runtime configuration could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [designSystemId]);

  function updateSetting(field: keyof RuntimeConfigurationInput, next: string) {
    setSettings((current) => ({ ...current, [field]: next }));
    setSettingsErrors((current) => ({ ...current, [field]: [] }));
    setSettingsSaved(false);
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeSettings(settings);
    const nextErrors = validateSettings(normalized);
    setSettingsErrors(nextErrors);
    setSettingsError(null);
    setSettingsSaved(false);
    if (Object.keys(nextErrors).length) return;

    setSettingsPending(true);
    try {
      const result = await designSystemsApi.setRuntimeConfiguration(
        designSystemId,
        normalized,
      );
      setSettings(normalized);
      setConfiguration(result);
      setSettingsSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setSettingsErrors(cause.fieldErrors);
        setSettingsError(cause.message);
      } else {
        setSettingsError("Runtime settings could not be saved.");
      }
    } finally {
      setSettingsPending(false);
    }
  }

  async function saveFigmaCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = figmaCredential.trim();
    setFigmaCredentialError(null);
    setFigmaCredentialSaved(false);
    if (!token) {
      setFigmaCredentialError("Enter a Figma access token.");
      return;
    }
    setFigmaCredentialPending(true);
    try {
      await designSystemsApi.setRuntimeCredentials(designSystemId, {
        figmaAccessToken: token,
      });
      setFigmaCredential("");
      setConfiguration((current) => credentialConfigured(current, "figma"));
      setFigmaCredentialSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setFigmaCredentialError(
          cause.fieldErrors.figmaAccessToken?.[0] || cause.message,
        );
      } else {
        setFigmaCredentialError("The Figma credential could not be saved.");
      }
    } finally {
      setFigmaCredentialPending(false);
    }
  }

  async function saveNpmCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = npmCredential.trim();
    setNpmCredentialError(null);
    setNpmCredentialSaved(false);
    if (!token) {
      setNpmCredentialError("Enter an npm access token.");
      return;
    }
    setNpmCredentialPending(true);
    try {
      await designSystemsApi.setRuntimeCredentials(designSystemId, {
        npmToken: token,
      });
      setNpmCredential("");
      setConfiguration((current) => credentialConfigured(current, "npm"));
      setNpmCredentialSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setNpmCredentialError(cause.fieldErrors.npmToken?.[0] || cause.message);
      } else {
        setNpmCredentialError("The npm credential could not be saved.");
      }
    } finally {
      setNpmCredentialPending(false);
    }
  }

  if (loadError) {
    return (
      <ErrorState
        title="Runtime configuration unavailable"
        description={loadError}
      />
    );
  }

  if (!configuration)
    return <LoadingState label="Loading runtime configuration…" />;

  return (
    <>
      {view === "configuration" ? (
        <Card variant="outlined" padding="lg">
          <DashboardSection
            title="Package configuration"
            description="Connect the source design file to its generated package."
            className="space-y-8"
          >
            {settingsSaved ? (
              <StatusBadge variant="live" label="Saved" />
            ) : null}
            {settingsError ? (
              <ErrorState
                title="Configuration could not be saved"
                description={settingsError}
              />
            ) : null}
            <form onSubmit={saveSettings} noValidate>
              <DashboardSection
                title={
                  configuration.packageVersion
                    ? `Version ${configuration.packageVersion}`
                    : undefined
                }
                action={
                  <Button
                    type="submit"
                    loading={settingsPending}
                  >
                    Save configuration
                  </Button>
                }
              >
                <DashboardGrid columns={2}>
                  <Field
                    label="Figma file URL or key"
                    description="Paste a Figma design URL or file key."
                    error={settingsErrors.figmaFileKey?.[0]}
                    required
                  >
                    <Input
                      id="figmaFileKey"
                      name="figmaFileKey"
                      value={settings.figmaFileKey}
                      onChange={(event) =>
                        updateSetting("figmaFileKey", event.target.value)
                      }
                      maxLength={255}
                      autoComplete="off"
                      spellCheck={false}
                      error={Boolean(settingsErrors.figmaFileKey?.length)}
                      aria-invalid={Boolean(
                        settingsErrors.figmaFileKey?.length,
                      )}
                      required
                    />
                  </Field>
                  <Field
                    label="npm package name"
                    description="Scoped names such as @acme/design-system are supported."
                    error={settingsErrors.packageName?.[0]}
                    required
                  >
                    <Input
                      id="packageName"
                      name="packageName"
                      value={settings.packageName}
                      onChange={(event) =>
                        updateSetting("packageName", event.target.value)
                      }
                      maxLength={214}
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      error={Boolean(settingsErrors.packageName?.length)}
                      aria-invalid={Boolean(settingsErrors.packageName?.length)}
                      required
                    />
                  </Field>
                </DashboardGrid>
              </DashboardSection>
            </form>
          </DashboardSection>
        </Card>
      ) : null}

      {view === "credentials" ? (
        <DashboardGrid columns={2}>
          <Card variant="outlined" padding="lg">
            <DashboardSection
              title="Figma token"
              description="Used only to read the configured design file."
              action={
                <StatusBadge
                  variant={
                    configuration.figmaAccessTokenConfigured
                      ? "live"
                      : "warning"
                  }
                  label={credentialStatus(
                    configuration.figmaAccessTokenConfigured,
                  )}
                />
              }
            >
              {figmaCredentialSaved ? (
                <StatusBadge variant="live" label="Saved" />
              ) : null}
              {figmaCredentialError ? (
                <ErrorState
                  title="Figma token could not be saved"
                  description={figmaCredentialError}
                />
              ) : null}
              <form onSubmit={saveFigmaCredential} noValidate>
                <DashboardSection>
                  <Field
                    label="Access token"
                    description="Saving replaces the current Figma token."
                    error={figmaCredentialError || undefined}
                  >
                    <Input
                      id="figmaAccessToken"
                      name="figmaAccessToken"
                      type="password"
                      value={figmaCredential}
                      onChange={(event) => {
                        setFigmaCredential(event.target.value);
                        setFigmaCredentialError(null);
                        setFigmaCredentialSaved(false);
                      }}
                      maxLength={4096}
                      autoComplete="off"
                      spellCheck={false}
                      error={Boolean(figmaCredentialError)}
                      aria-invalid={Boolean(figmaCredentialError)}
                    />
                  </Field>
                  <Button
                    type="submit"
                    loading={figmaCredentialPending}
                  >
                    Save Figma token
                  </Button>
                </DashboardSection>
              </form>
            </DashboardSection>
          </Card>

          <Card variant="outlined" padding="lg">
            <DashboardSection
              title="npm token"
              description="Required only when generated packages are published."
              action={
                <StatusBadge
                  variant={
                    configuration.npmTokenConfigured ? "live" : "warning"
                  }
                  label={credentialStatus(configuration.npmTokenConfigured)}
                />
              }
            >
              {npmCredentialSaved ? (
                <StatusBadge variant="live" label="Saved" />
              ) : null}
              {npmCredentialError ? (
                <ErrorState
                  title="npm token could not be saved"
                  description={npmCredentialError}
                />
              ) : null}
              <form onSubmit={saveNpmCredential} noValidate>
                <DashboardSection>
                  <Field
                    label="Access token"
                    description="Saving replaces the current npm token."
                    error={npmCredentialError || undefined}
                  >
                    <Input
                      id="npmToken"
                      name="npmToken"
                      type="password"
                      value={npmCredential}
                      onChange={(event) => {
                        setNpmCredential(event.target.value);
                        setNpmCredentialError(null);
                        setNpmCredentialSaved(false);
                      }}
                      maxLength={4096}
                      autoComplete="off"
                      spellCheck={false}
                      error={Boolean(npmCredentialError)}
                      aria-invalid={Boolean(npmCredentialError)}
                    />
                  </Field>
                  <Button
                    type="submit"
                    loading={npmCredentialPending}
                  >
                    Save npm token
                  </Button>
                </DashboardSection>
              </form>
            </DashboardSection>
          </Card>
        </DashboardGrid>
      ) : null}
    </>
  );
}

function normalizeSettings(
  input: RuntimeConfigurationInput,
): RuntimeConfigurationInput {
  return {
    figmaFileKey: extractFigmaFileKey(input.figmaFileKey),
    packageName: input.packageName.trim(),
  };
}

function extractFigmaFileKey(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)figma\.com$/i.test(url.hostname)) return trimmed;
    const match = url.pathname.match(/^\/(?:file|design|board)\/([^/]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
  } catch {
    return trimmed;
  }
}

function validateSettings(input: RuntimeConfigurationInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.figmaFileKey)
    errors.figmaFileKey = ["Figma file key is required."];
  else if (/^figd_/i.test(input.figmaFileKey))
    errors.figmaFileKey = [
      "This looks like a Figma access token. Enter the file URL or key instead.",
    ];
  else if (!/^[A-Za-z0-9_-]+$/.test(input.figmaFileKey))
    errors.figmaFileKey = ["Enter a valid Figma design URL or file key."];
  const packageName = validateNpmPackageName(input.packageName);
  if (!input.packageName) errors.packageName = ["Package name is required."];
  else if (!packageName.validForNewPackages)
    errors.packageName = [
      packageName.errors?.[0] ||
        packageName.warnings?.[0] ||
        "Enter a valid npm package name.",
    ];
  return errors;
}

function credentialStatus(configured: boolean) {
  return configured ? "Configured" : "Not configured";
}

export function credentialConfigured(
  current: RuntimeConfiguration | null,
  credential: "figma" | "npm",
): RuntimeConfiguration | null {
  if (!current) return null;
  if (credential === "npm") return { ...current, npmTokenConfigured: true };
  return {
    ...current,
    figmaAccessTokenConfigured: true,
    generationConfigured: Boolean(current.figmaFileKey && current.packageName),
  };
}
