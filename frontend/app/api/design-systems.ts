import { apiRequest } from "./api-client";

export type DesignSystem = {
  id: string;
  name: string;
  description: string | null;
  lastPublishedVersion: string | null;
  generationContract: "legacy" | "composable-v1";
  createdAt: string;
  updatedAt: string;
};

export type DesignSystemInput = Pick<DesignSystem, "name" | "description"> & {
  generationContract?: DesignSystem["generationContract"];
};

export type RuntimeConfigurationInput = {
  figmaFileKey: string;
  packageName: string;
};

export type RuntimeCredentialsInput = {
  figmaAccessToken?: string;
  npmToken?: string;
};

export type RuntimeConfiguration = {
  designSystemId: string;
  figmaFileKey: string | null;
  packageName: string | null;
  packageVersion: string | null;
  npmRegistry: string | null;
  figmaAccessTokenConfigured: boolean;
  npmTokenConfigured: boolean;
  generationConfigured: boolean;
};

export const designSystemsApi = {
  list: () => apiRequest<DesignSystem[]>("/v1/design-systems"),
  get: (id: string) =>
    apiRequest<DesignSystem>(`/v1/design-systems/${encodeURIComponent(id)}`),
  create: (input: DesignSystemInput) =>
    apiRequest<DesignSystem>("/v1/design-systems", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: DesignSystemInput) =>
    apiRequest<DesignSystem>(`/v1/design-systems/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  delete: (id: string) =>
    apiRequest<void>(`/v1/design-systems/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  getRuntimeConfiguration: (id: string) =>
    apiRequest<RuntimeConfiguration>(
      `/v1/design-systems/${encodeURIComponent(id)}/runtime-configuration`,
    ),
  setRuntimeConfiguration: (id: string, input: RuntimeConfigurationInput) =>
    apiRequest<RuntimeConfiguration>(
      `/v1/design-systems/${encodeURIComponent(id)}/runtime-configuration`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  setRuntimeCredentials: (id: string, input: RuntimeCredentialsInput) =>
    apiRequest<{ designSystemId: string; configured: true }>(
      `/v1/design-systems/${encodeURIComponent(id)}/runtime-credentials`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
};
