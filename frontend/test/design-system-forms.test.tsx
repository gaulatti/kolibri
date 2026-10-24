import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "../app/bleecker";
import { DesignSystemForm } from "../app/design-systems/design-system-form";
import { RuntimeConfigurationForm, credentialConfigured } from "../app/design-systems/runtime-configuration-form";
import { designSystemsApi, type RuntimeConfiguration } from "../app/api/design-systems";
import { ApiError } from "../app/api/api-client";

const configured: RuntimeConfiguration = { designSystemId: "design", figmaFileKey: "file", packageName: "@fixture/design", packageVersion: "1.0.0", npmRegistry: "https://registry.example", figmaAccessTokenConfigured: true, npmTokenConfigured: true, generationConfigured: true };
function mounted(element: React.ReactNode) { return render(<MemoryRouter><ThemeProvider defaultTheme="light">{element}</ThemeProvider></MemoryRouter>); }
function input(id: string) { const element = document.getElementById(id); expect(element).toBeTruthy(); return element as HTMLInputElement; }
function change(id: string, value: string) { fireEvent.change(input(id), { target: { value } }); }

beforeEach(() => {
  vi.spyOn(designSystemsApi, "getRuntimeConfiguration").mockResolvedValue({ ...configured });
  vi.spyOn(designSystemsApi, "setRuntimeConfiguration").mockResolvedValue({ ...configured });
  vi.spyOn(designSystemsApi, "setRuntimeCredentials").mockResolvedValue({ designSystemId: "design", configured: true });
});

it("validates a blank design-system form and submits trimmed values", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  mounted(<DesignSystemForm submitLabel="Create design system" onSubmit={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Create design system" }));
  expect(await screen.findByText("Name is required.")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  change("name", " Fixture design "); change("description", " Description ");
  fireEvent.click(screen.getByRole("button", { name: "Create design system" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ name: "Fixture design", description: "Description", generationContract: "composable-v1" }));
  expect(screen.queryByText("Name is required.")).toBeNull();
});
it("lets the user explicitly choose the legacy component contract", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  mounted(<DesignSystemForm initialValue={{ name: "Fixture", description: null }} submitLabel="Save" onSubmit={save} />);
  await userEvent.click(document.getElementById("generation-contract")!);
  await userEvent.click(await screen.findByRole("option", { name: "Legacy generated components" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ name: "Fixture", description: "", generationContract: "legacy" }));
});
it("merges independent credential updates without inventing unloaded configuration", () => {
  expect(credentialConfigured(null, "figma")).toBeNull();
  const empty = { ...configured, figmaFileKey: null, packageName: null, figmaAccessTokenConfigured: false, npmTokenConfigured: false, generationConfigured: false };
  expect(credentialConfigured(empty, "figma")).toEqual({ ...empty, figmaAccessTokenConfigured: true });
  const sourceOnly = { ...empty, figmaFileKey: "file" };
  expect(credentialConfigured(sourceOnly, "figma")?.generationConfigured).toBe(false);
  const withSource = { ...empty, figmaFileKey: "file", packageName: "@fixture/design" };
  const npm = credentialConfigured(withSource, "npm");
  expect(credentialConfigured(npm, "figma")).toEqual({ ...withSource, figmaAccessTokenConfigured: true, npmTokenConfigured: true, generationConfigured: true });
  expect(empty.npmTokenConfigured).toBe(false);
});
it.each([
  new ApiError("Validation rejected", 422, { name: ["Already exists"], description: ["Not allowed"] }),
  new Error("Network unavailable"), "unexpected failure",
])("retains entered values and shows save failure %s", async (cause) => {
  const save = vi.fn().mockRejectedValue(cause);
  mounted(<DesignSystemForm initialValue={{ name: "Fixture", description: null }} submitLabel="Save changes" onSubmit={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText(cause instanceof Error ? cause.message : "The design system could not be saved.")).toBeTruthy();
  if (cause instanceof ApiError) { expect(screen.getByText("Already exists")).toBeTruthy(); expect(screen.getByText("Not allowed")).toBeTruthy(); }
  expect(input("name").value).toBe("Fixture");
  expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(false);
});

it("loads and saves normalized Figma URLs without accepting tokens as file identifiers", async () => {
  mounted(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  expect(screen.getByText("Loading runtime configuration…")).toBeTruthy();
  await screen.findByText("Package configuration");
  expect(screen.getByText("Version 1.0.0")).toBeTruthy();
  change("figmaFileKey", " https://www.figma.com/design/ABC_123/Fixture ");
  change("packageName", " @fixture/new ");
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  await waitFor(() => expect(designSystemsApi.setRuntimeConfiguration).toHaveBeenCalledWith("design", { figmaFileKey: "ABC_123", packageName: "@fixture/new" }));
  expect(await screen.findByText("Saved")).toBeTruthy();
  change("figmaFileKey", "figd_not-a-real-token");
  expect(screen.queryByText("Saved")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(await screen.findByText("This looks like a Figma access token. Enter the file URL or key instead.")).toBeTruthy();
  expect(designSystemsApi.setRuntimeConfiguration).toHaveBeenCalledOnce();
});
it.each([
  ["", "", "Figma file key is required.", "Package name is required."],
  ["https://evil.example/design/key", "not a package", "Enter a valid Figma design URL or file key.", "name can only contain URL-friendly characters"],
  ["https://figma.com/unknown/key", "@fixture/design", "Enter a valid Figma design URL or file key.", null],
])("rejects invalid runtime settings %s", async (key, name, keyError, nameError) => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockResolvedValueOnce({ ...configured, figmaFileKey: null, packageName: null, packageVersion: null });
  mounted(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  await screen.findByText("Package configuration");
  change("figmaFileKey", key!); change("packageName", name!);
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(await screen.findByText(keyError!)).toBeTruthy();
  if (nameError) expect(screen.getByText(nameError)).toBeTruthy();
  expect(designSystemsApi.setRuntimeConfiguration).not.toHaveBeenCalled();
});
it.each([new ApiError("Server validation", 422, { figmaFileKey: ["File not accessible"] }), new Error("Transport failed")])("reports runtime save failure %s", async (cause) => {
  vi.mocked(designSystemsApi.setRuntimeConfiguration).mockRejectedValueOnce(cause);
  mounted(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  await screen.findByText("Package configuration");
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "Runtime settings could not be saved.")).toBeTruthy();
  if (cause instanceof ApiError) expect(screen.getByText("File not accessible")).toBeTruthy();
});
it.each([new ApiError("Not owner", 403), new Error("Network")])("reports runtime load failure %s", async (cause) => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockRejectedValueOnce(cause);
  mounted(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "Runtime configuration could not be loaded.")).toBeTruthy();
});
it("does not install runtime configuration arriving after unmount", async () => {
  let complete!: (config: RuntimeConfiguration) => void;
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  const view = mounted(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  view.unmount();
  await act(async () => { complete(configured); });
  expect(designSystemsApi.setRuntimeConfiguration).not.toHaveBeenCalled();
});
it("does not display a late runtime failure after unmount", async () => {
  let fail!: (error: Error) => void;
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const view = mounted(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  view.unmount();
  await act(async () => { fail(new Error("Late network error")); });
  expect(screen.queryByText("Runtime configuration unavailable")).toBeNull();
});

it.each([["figmaAccessToken", "Figma"], ["npmToken", "npm"]])("saves %s independently and clears its write-only input", async (id, label) => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockResolvedValueOnce({ ...configured, figmaAccessTokenConfigured: false, npmTokenConfigured: false, generationConfigured: false });
  mounted(<RuntimeConfigurationForm designSystemId="design" view="credentials" />);
  await screen.findByText("Figma token");
  fireEvent.click(screen.getByRole("button", { name: `Save ${label} token` }));
  expect((await screen.findAllByText(`Enter ${label === "Figma" ? "a Figma" : "an npm"} access token.`)).length).toBeGreaterThan(0);
  change(id, " fixture-not-a-real-credential ");
  fireEvent.click(screen.getByRole("button", { name: `Save ${label} token` }));
  await waitFor(() => expect(designSystemsApi.setRuntimeCredentials).toHaveBeenCalledWith("design", { [id]: "fixture-not-a-real-credential" }));
  expect(input(id).value).toBe("");
  expect(await screen.findByText("Saved")).toBeTruthy();
  expect(screen.getByText("Configured")).toBeTruthy();
});
it.each([
  ["figmaAccessToken", "Figma", new ApiError("Denied", 403, { figmaAccessToken: ["Invalid credential"] }), "Invalid credential"],
  ["figmaAccessToken", "Figma", new ApiError("Denied", 403), "Denied"],
  ["figmaAccessToken", "Figma", new Error("Network"), "The Figma credential could not be saved."],
  ["npmToken", "npm", new ApiError("Denied", 403, { npmToken: ["Invalid credential"] }), "Invalid credential"],
  ["npmToken", "npm", new ApiError("Denied", 403), "Denied"],
  ["npmToken", "npm", new Error("Network"), "The npm credential could not be saved."],
])("shows independent credential failure %s %s %s", async (id, label, cause, message) => {
  vi.mocked(designSystemsApi.setRuntimeCredentials).mockRejectedValueOnce(cause);
  mounted(<RuntimeConfigurationForm designSystemId="design" view="credentials" />);
  await screen.findByText("Figma token");
  change(id as string, "fixture-not-a-real-credential");
  fireEvent.click(screen.getByRole("button", { name: `Save ${label} token` }));
  expect((await screen.findAllByText(message as string)).length).toBeGreaterThan(0);
  expect(input(id as string).value).toBe("fixture-not-a-real-credential");
});
