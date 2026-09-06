import {
  Button,
  Card,
  DashboardSection,
  DataList,
  ErrorState,
  Switch,
} from "~/bleecker";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../api/api-client";
import {
  designSystemsApi,
  type DesignSystem,
  type RuntimeConfiguration,
} from "../api/design-systems";
import { generationsApi } from "../api/generations";
import { LoadingState } from "../components/loading-state";

export function GenerationLauncher({
  designSystem,
  onConfigure,
  onCredentials,
}: {
  designSystem: DesignSystem;
  onConfigure: () => void;
  onCredentials: () => void;
}) {
  const [configuration, setConfiguration] =
    useState<RuntimeConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishToNpm, setPublishToNpm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submissionInFlight = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    designSystemsApi
      .getRuntimeConfiguration(designSystem.id)
      .then((result) => {
        if (active) setConfiguration(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadError(
          cause instanceof ApiError
            ? cause.message
            : "Configuration could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [designSystem.id]);

  async function startGeneration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current || !configuration?.generationConfigured)
      return;
    submissionInFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const queued = await generationsApi.start(designSystem.id, publishToNpm);
      navigate(`/generations/${queued.runId}`, { replace: true });
    } catch (cause) {
      setSubmitError(
        cause instanceof ApiError
          ? cause.message
          : "Generation could not be started.",
      );
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading configuration…" />;
  if (loadError)
    return (
      <ErrorState title="Generation unavailable" description={loadError} />
    );
  if (!configuration) return null;

  return (
    <Card variant="outlined" padding="lg">
      <DashboardSection
        title="Generate package"
        description="Create a versioned package from the current Figma source."
        className="space-y-8"
      >
        {submitError ? (
          <ErrorState
            title="Generation could not be started"
            description={submitError}
          />
        ) : null}

        <DataList
          items={[
            {
              id: "package",
              label: "Package",
              value: configuration.packageName || "Not configured",
            },
          ]}
        />

        {!configuration.generationConfigured ? (
          <Button variant="secondary" type="button" onClick={onConfigure}>
            Complete configuration
          </Button>
        ) : (
          <form onSubmit={startGeneration}>
            <DashboardSection
              title="Publish to npm"
              description="Optionally publish the generated version after validation succeeds."
              action={
                <Button
                  type="submit"
                  loading={submitting}
                >
                  {publishToNpm ? "Generate and publish" : "Generate package"}
                </Button>
              }
            >
              <div className="flex flex-wrap items-center gap-4">
                <Switch
                  checked={publishToNpm}
                  onCheckedChange={setPublishToNpm}
                  disabled={submitting || !configuration.npmTokenConfigured}
                  aria-label="Publish to npm"
                />
                <span className="font-secondary text-sm text-text-secondary">
                  {publishToNpm ? "Publication enabled" : "Generation only"}
                </span>
                {!configuration.npmTokenConfigured ? (
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onCredentials}
                  >
                    Add npm token
                  </Button>
                ) : null}
              </div>
            </DashboardSection>
          </form>
        )}
      </DashboardSection>
    </Card>
  );
}
