export interface InfrastructureConfiguration {
  readonly domainName: string;
  readonly hostedZoneId: string;
  readonly kolibriSubdomain: string;
  readonly fqdn: string;
  readonly frontendUrl: string;
  readonly frontendCallbackUrl: string;
  readonly frontendLogoutUrl: string;
}

export function resolveInfrastructureConfiguration(
  domainNameValue: string,
  hostedZoneIdValue: string,
  kolibriSubdomainValue: string,
): InfrastructureConfiguration {
  const domainName = normalizedDomain(domainNameValue);
  const hostedZoneId = normalizedHostedZoneId(hostedZoneIdValue);
  const kolibriSubdomain = normalizedSubdomain(kolibriSubdomainValue);
  const fqdn = `${kolibriSubdomain}.${domainName}`;
  const frontendUrl = `https://${fqdn}`;

  return {
    domainName,
    hostedZoneId,
    kolibriSubdomain,
    fqdn,
    frontendUrl,
    frontendCallbackUrl: `${frontendUrl}/auth/callback`,
    frontendLogoutUrl: `${frontendUrl}/sign-in?signedOut=1`,
  };
}

function normalizedDomain(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) {
    throw new Error('KOLIBRI_DOMAIN must be a valid DNS domain name');
  }
  return normalized;
}

function normalizedSubdomain(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^\.|\.$/g, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    throw new Error('KOLIBRI_SUBDOMAIN must be a single valid DNS label');
  }
  return normalized;
}

function normalizedHostedZoneId(value: string): string {
  const normalized = value.trim().replace(/^\/hostedzone\//, '');
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    throw new Error('KOLIBRI_HOSTED_ZONE_ID must be a valid Route 53 hosted zone ID');
  }
  return normalized;
}
