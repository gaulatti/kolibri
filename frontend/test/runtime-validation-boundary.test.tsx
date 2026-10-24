import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RuntimeConfigurationForm } from "../app/design-systems/runtime-configuration-form";
import { designSystemsApi } from "../app/api/design-systems";
import { renderPage, runtime } from "./render";

const { validatePackage } = vi.hoisted(() => ({ validatePackage: vi.fn() }));
vi.mock("validate-npm-package-name", () => ({ default: validatePackage }));
beforeEach(() => {
  vi.spyOn(designSystemsApi, "getRuntimeConfiguration").mockResolvedValue(runtime);
  vi.spyOn(designSystemsApi, "setRuntimeConfiguration").mockResolvedValue(runtime);
});
it.each([
  [{ validForNewPackages: false, validForOldPackages: true, warnings: ["Legacy names cannot be newly published"] }, "Legacy names cannot be newly published"],
  [{ validForNewPackages: false, validForOldPackages: false }, "Enter a valid npm package name."],
])("fails closed on package-validator rejection even without a detailed diagnostic", async (result, message) => {
  validatePackage.mockReturnValueOnce(result);
  renderPage(<RuntimeConfigurationForm designSystemId="design" view="configuration" />);
  await screen.findByText("Package configuration");
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(await screen.findByText(message)).toBeTruthy();
  expect(designSystemsApi.setRuntimeConfiguration).not.toHaveBeenCalled();
});
