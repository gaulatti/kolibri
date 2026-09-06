import * as cdk from "aws-cdk-lib/core";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface StorageResources {
  readonly designSystemRuntimeSecret: secretsmanager.CfnSecret;
  readonly frontendBucket: s3.Bucket;
  readonly generationBucket: s3.Bucket;
  readonly systemSecret: secretsmanager.CfnSecret;
}

export interface StorageProps {
  readonly frontendUrl: string;
  readonly stackNamespace: string;
}

export function createStorage(
  scope: Construct,
  props: StorageProps,
): StorageResources {
  const frontendBucket = new s3.Bucket(scope, "FrontendBucket", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });

  const generationBucket = new s3.Bucket(scope, "GenerationStorageBucket", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    versioned: true,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    cors: [
      {
        allowedHeaders: ["*"],
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: [
          props.frontendUrl,
          "http://localhost:5173",
          "http://localhost:5188",
          "https://kolibri.dev",
        ],
        exposedHeaders: ["Content-Disposition", "Content-Type"],
        maxAge: 300,
      },
    ],
  });

  const systemSecret = new secretsmanager.CfnSecret(
    scope,
    "SystemConfigurationSecret",
    {
      description: "Singleton runtime configuration for the Kolibri backend.",
      name: `${props.stackNamespace}/system`,
    },
  );
  systemSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  const designSystemRuntimeSecret = new secretsmanager.CfnSecret(
    scope,
    "DesignSystemRuntimeSecret",
    {
      description:
        "Singleton runtime configuration for all Kolibri design systems.",
      name: `${props.stackNamespace}/runtime/design-systems`,
    },
  );
  designSystemRuntimeSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  return {
    designSystemRuntimeSecret,
    frontendBucket,
    generationBucket,
    systemSecret,
  };
}
