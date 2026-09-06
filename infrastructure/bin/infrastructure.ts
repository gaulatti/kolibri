#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib/core';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import {
  INFRASTRUCTURE_REGION,
  INFRASTRUCTURE_STACK_NAME,
} from '../lib/stack-identity';

const app = new cdk.App();
new InfrastructureStack(app, INFRASTRUCTURE_STACK_NAME, {
  domainName: requiredEnvironment('KOLIBRI_DOMAIN'),
  googleOAuthClientId: requiredEnvironment('GOOGLE_OAUTH_CLIENT_ID'),
  googleOAuthClientSecret: requiredEnvironment('GOOGLE_OAUTH_CLIENT_SECRET'),
  hostedZoneId: requiredEnvironment('KOLIBRI_HOSTED_ZONE_ID'),
  kolibriSubdomain: requiredEnvironment('KOLIBRI_SUBDOMAIN'),
  env: {
    region: INFRASTRUCTURE_REGION,
  },
  description: 'Kolibri managed AWS resources; backend and PostgreSQL remain on premises.',
});

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required infrastructure environment variable: ${name}`);
  return value;
}
