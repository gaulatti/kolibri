import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { createAuthentication } from "./authentication";
import { createComputeResources } from "./compute";
import { resolveInfrastructureConfiguration } from "./configuration";
import { createFrontendHosting } from "./frontend-hosting";
import { createIamResources } from "./iam";
import { createStorage } from "./storage";

export interface InfrastructureStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly googleOAuthClientId: string;
  readonly googleOAuthClientSecret: string;
  readonly hostedZoneId: string;
  readonly kolibriSubdomain: string;
}

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    if (!cdk.Token.isUnresolved(this.region) && this.region !== "us-east-1") {
      throw new Error(
        "The infrastructure stack must be deployed in us-east-1 for CloudFront TLS",
      );
    }

    const configuration = resolveInfrastructureConfiguration(
      props.domainName,
      props.hostedZoneId,
      props.kolibriSubdomain,
    );
    const stackNamespace = this.stackName;
    const generationStoragePrefix = stackNamespace;

    const storage = createStorage(this, {
      frontendUrl: configuration.frontendUrl,
      stackNamespace,
    });
    const frontendHosting = createFrontendHosting(this, {
      domainName: configuration.domainName,
      hostedZoneId: configuration.hostedZoneId,
      kolibriSubdomain: configuration.kolibriSubdomain,
      fqdn: configuration.fqdn,
      frontendBucket: storage.frontendBucket,
    });
    const authentication = createAuthentication(this, {
      frontendCallbackUrl: configuration.frontendCallbackUrl,
      frontendLogoutUrl: configuration.frontendLogoutUrl,
      googleOAuthClientId: props.googleOAuthClientId,
      googleOAuthClientSecret: props.googleOAuthClientSecret,
      kolibriSubdomain: configuration.kolibriSubdomain,
    });
    const compute = createComputeResources(this, stackNamespace);
    const access = createIamResources(this, {
      stackNamespace,
      generationStoragePrefix,
      designSystemRuntimeSecret: storage.designSystemRuntimeSecret,
      generationBucket: storage.generationBucket,
      frontendBucket: storage.frontendBucket,
      systemSecret: storage.systemSecret,
      distribution: frontendHosting.distribution,
      containerRepository: compute.containerRepository,
    });

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: authentication.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "CognitoHostedDomain", {
      value: authentication.hostedDomainUrl,
    });
    new cdk.CfnOutput(this, "FrontendCognitoClientId", {
      value: authentication.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "FrontendCognitoDomain", {
      value: authentication.hostedDomainUrl,
    });
    new cdk.CfnOutput(this, "AwsRegion", { value: this.region });
    new cdk.CfnOutput(this, "GenerationStorageBucketName", {
      value: storage.generationBucket.bucketName,
    });
    new cdk.CfnOutput(this, "GenerationStoragePrefixValue", {
      value: generationStoragePrefix,
    });
    new cdk.CfnOutput(this, "KolibriSystemSecretNameValue", {
      value: `${stackNamespace}/system`,
    });
    new cdk.CfnOutput(this, "DesignSystemRuntimeSecretNameValue", {
      value: `${stackNamespace}/runtime/design-systems`,
    });
    new cdk.CfnOutput(this, "KolibriStackName", { value: stackNamespace });
    new cdk.CfnOutput(this, "BackendRuntimeUserName", {
      value: access.backendRuntimeUser.userName,
    });
    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: storage.frontendBucket.bucketName,
    });
    new cdk.CfnOutput(this, "FrontendDistributionId", {
      value: frontendHosting.distribution.distributionId,
    });
    new cdk.CfnOutput(this, "FrontendDistributionDomainName", {
      value: frontendHosting.distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "FrontendPublisherUserName", {
      value: access.frontendPublisher.userName,
    });
    new cdk.CfnOutput(this, "FrontendPublisherAccessKeyId", {
      value: access.frontendPublisherAccessKey.ref,
    });
    new cdk.CfnOutput(this, "FrontendPublisherSecretAccessKey", {
      value: access.frontendPublisherAccessKey.attrSecretAccessKey,
    });
    new cdk.CfnOutput(this, "ContainerRepositoryName", {
      value: compute.containerRepository.repositoryName,
    });
    new cdk.CfnOutput(this, "ContainerRepositoryUri", {
      value: compute.containerRepository.repositoryUri,
    });
    new cdk.CfnOutput(this, "FrontendUrl", {
      value: configuration.frontendUrl,
    });
    new cdk.CfnOutput(this, "FrontendCallbackUrl", {
      value: configuration.frontendCallbackUrl,
    });
    new cdk.CfnOutput(this, "FrontendLogoutUrl", {
      value: configuration.frontendLogoutUrl,
    });
    new cdk.CfnOutput(this, "FrontendCertificateArn", {
      value: frontendHosting.certificate.certificateArn,
    });
    new cdk.CfnOutput(this, "KolibriFqdn", {
      value: configuration.fqdn,
    });
  }
}
