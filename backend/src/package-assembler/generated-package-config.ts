export type GeneratedPackageConfig = {
  packageName: string;
  packageVersion: string;
  packageDirectoryName: string;
};

export function derivePackageDirectoryName(packageName: string): string {
  return packageName
    .replace(/^@/, '')
    .replaceAll('/', '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase();
}

export function loadGeneratedPackageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GeneratedPackageConfig {
  const packageName =
    environment.KOLIBRI_PACKAGE_NAME?.trim() || '@kolibri/design-system';
  const packageVersion = environment.KOLIBRI_PACKAGE_VERSION?.trim() || '0.1.0';
  const packageDirectoryName = derivePackageDirectoryName(packageName);

  if (!packageDirectoryName || ['.', '..'].includes(packageDirectoryName)) {
    throw new Error(
      'KOLIBRI_PACKAGE_NAME must derive to a safe directory name',
    );
  }
  return { packageName, packageVersion, packageDirectoryName };
}
