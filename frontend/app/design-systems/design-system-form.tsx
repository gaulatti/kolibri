import {
  Button,
  Card,
  DashboardGrid,
  DashboardSection,
  ErrorState,
  Field,
  Input,
  Select,
  Textarea,
} from "~/bleecker";
import { useState } from "react";
import type { DesignSystemInput } from "../api/design-systems";
import { ApiError, type FieldErrors } from "../api/api-client";
import { trimmedDesignSystem, validateDesignSystem } from "./validation";

const EMPTY_INPUT: DesignSystemInput = {
  name: "",
  description: "",
  generationContract: "composable-v1",
};

type Props = {
  initialValue?: DesignSystemInput;
  submitLabel: string;
  onSubmit: (input: DesignSystemInput) => Promise<void>;
};

export function DesignSystemForm({
  initialValue,
  submitLabel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState<DesignSystemInput>(
    initialValue ?? EMPTY_INPUT,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = trimmedDesignSystem(value);
    const clientErrors = validateDesignSystem(normalized);
    setErrors(clientErrors);
    setGeneralError(null);
    if (Object.keys(clientErrors).length) return;
    setSubmitting(true);
    try {
      await onSubmit(normalized);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setGeneralError(error.message);
      } else {
        setGeneralError(
          error instanceof Error
            ? error.message
            : "The design system could not be saved.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function update(field: keyof DesignSystemInput, next: string) {
    setValue((current) => ({ ...current, [field]: next }));
    setErrors((current) => ({ ...current, [field]: [] }));
  }

  return (
    <Card className="max-w-4xl" variant="outlined" padding="lg">
      <form onSubmit={submit} noValidate>
        <DashboardSection className="space-y-8">
          {generalError ? (
            <ErrorState
              title="We couldn't save your changes"
              description={generalError}
            />
          ) : null}
          <DashboardGrid columns={2}>
            <Field
              label="Design-system name"
              error={errors.name?.[0]}
              required
            >
              <Input
                id="name"
                name="name"
                value={value.name}
                onChange={(event) => update("name", event.target.value)}
                maxLength={200}
                autoComplete="off"
                error={Boolean(errors.name?.length)}
                aria-invalid={Boolean(errors.name?.length)}
                required
              />
            </Field>
            <Field
              label="Component contract"
              description="Choose the generated component architecture."
              required
            >
              <Select
                id="generation-contract"
                value={value.generationContract ?? "composable-v1"}
                onChange={(next) => update("generationContract", next)}
                options={[
                  {
                    value: "composable-v1",
                    label: "Composable views and behavior adapters",
                  },
                  { value: "legacy", label: "Legacy generated components" },
                ]}
              />
            </Field>
            <Field
              className="sm:col-span-2"
              label="Description"
              error={errors.description?.[0]}
              optional
            >
              <Textarea
                id="description"
                name="description"
                value={value.description ?? ""}
                onChange={(event) => update("description", event.target.value)}
                maxLength={1000}
                rows={5}
                autoComplete="off"
                error={Boolean(errors.description?.length)}
                aria-invalid={Boolean(errors.description?.length)}
              />
            </Field>
          </DashboardGrid>
          <div className="flex justify-end border-t border-sand/20 pt-6 dark:border-white/[0.07]">
            <Button type="submit" loading={submitting}>
              {submitLabel}
            </Button>
          </div>
        </DashboardSection>
      </form>
    </Card>
  );
}
