import type { DesignSystemInput } from "../api/design-systems";
import type { FieldErrors } from "../api/api-client";

export function validateDesignSystem(input: DesignSystemInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name) errors.name = ["Name is required."];
  else if (input.name.length > 200)
    errors.name = ["Name must be 200 characters or fewer."];

  if ((input.description ?? "").length > 1000)
    errors.description = ["Description must be 1,000 characters or fewer."];
  return errors;
}

export function trimmedDesignSystem(
  input: DesignSystemInput,
): DesignSystemInput {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || "",
    generationContract: input.generationContract,
  };
}
