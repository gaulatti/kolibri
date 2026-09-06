import * as cdk from "aws-cdk-lib/core";
import { Match, Template } from "aws-cdk-lib/assertions";
import { InfrastructureStack } from "../lib/infrastructure-stack";

function synthesizedTemplate(): Template {
  const app = new cdk.App();
  const stack = new InfrastructureStack(app, "TestInfrastructureStack", {
    domainName: "example.com",
    env: { account: "111111111111", region: "us-east-1" },
    googleOAuthClientId: "test-google-client-id",
    googleOAuthClientSecret: "test-google-client-secret",
    hostedZoneId: "Z1111111111111",
    kolibriSubdomain: "kolibri",
  });
  return Template.fromStack(stack);
}

describe("Kolibri infrastructure", () => {
  const template = synthesizedTemplate();

  it("creates Cognito hosted authentication with deployment-supplied Google credentials", () => {
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.resourceCountIs("AWS::Cognito::UserPoolClient", 1);
    template.resourceCountIs("AWS::Cognito::UserPoolDomain", 1);
    template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: "kolibri-111111111111",
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      AllowedOAuthFlows: ["code"],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthScopes: Match.arrayWith(["openid", "email", "profile"]),
      CallbackURLs: Match.arrayWith([
        "https://kolibri.example.com/auth/callback",
        "http://localhost:5173/auth/callback",
      ]),
      GenerateSecret: false,
      LogoutURLs: Match.arrayWith([
        "https://kolibri.example.com/sign-in?signedOut=1",
        "http://localhost:5173/sign-in?signedOut=1",
      ]),
      SupportedIdentityProviders: ["Google"],
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", {
      ProviderName: "Google",
      ProviderType: "Google",
      ProviderDetails: Match.objectLike({
        authorize_scopes: "openid email profile",
        client_id: "test-google-client-id",
        client_secret: "test-google-client-secret",
      }),
    });
    expect(template.toJSON().Parameters).not.toHaveProperty(
      "CognitoDomainPrefix",
    );
    expect(template.toJSON().Parameters).not.toHaveProperty(
      "GoogleOAuthClientId",
    );
    expect(template.toJSON().Parameters).not.toHaveProperty(
      "GoogleOAuthClientSecret",
    );
  });

  it("creates two encrypted private buckets and S3-compatible generation prefixes", () => {
    template.resourceCountIs("AWS::S3::Bucket", 2);
    const buckets = template.findResources("AWS::S3::Bucket");
    for (const bucket of Object.values(buckets)) {
      expect(bucket.Properties).toMatchObject({
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    }
    template.hasResourceProperties("AWS::S3::Bucket", {
      VersioningConfiguration: { Status: "Enabled" },
      CorsConfiguration: {
        CorsRules: Match.arrayWith([
          Match.objectLike({ AllowedMethods: ["GET"] }),
        ]),
      },
    });
  });

  it("hosts the SPA through CloudFront origin access control and secure headers", () => {
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "kolibri.example.com",
      ValidationMethod: "DNS",
    });
    template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
      OriginAccessControlConfig: Match.objectLike({
        OriginAccessControlOriginType: "s3",
        SigningBehavior: "always",
        SigningProtocol: "sigv4",
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["kolibri.example.com"],
        DefaultRootObject: "index.html",
        DefaultCacheBehavior: Match.objectLike({
          ResponseHeadersPolicyId: Match.anyValue(),
          ViewerProtocolPolicy: "redirect-to-https",
        }),
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
        ]),
      }),
    });
    template.resourceCountIs("AWS::Route53::RecordSet", 2);
    template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: "kolibri.example.com.",
      Type: "A",
      AliasTarget: Match.objectLike({
        DNSName: Match.anyValue(),
        HostedZoneId: Match.anyValue(),
      }),
    });
    template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: "kolibri.example.com.",
      Type: "AAAA",
      AliasTarget: Match.objectLike({
        DNSName: Match.anyValue(),
        HostedZoneId: Match.anyValue(),
      }),
    });
  });

  it("emits the canonical frontend DNS outputs", () => {
    template.hasOutput("KolibriFqdn", { Value: "kolibri.example.com" });
    template.hasOutput("FrontendUrl", { Value: "https://kolibri.example.com" });
    template.hasOutput("FrontendCallbackUrl", {
      Value: "https://kolibri.example.com/auth/callback",
    });
    const outputs = template.toJSON().Outputs;
    for (const outputName of ["CognitoHostedDomain", "FrontendCognitoDomain"]) {
      expect(outputs[outputName].Value).toEqual({
        "Fn::Join": [
          "",
          [
            "https://",
            { Ref: expect.stringContaining("HostedDomain") },
            ".auth.us-east-1.amazoncognito.com",
          ],
        ],
      });
    }
  });

  it("limits the backend runtime user to application data, image pull, and logs", () => {
    template.resourceCountIs("AWS::SecretsManager::Secret", 2);
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: "TestInfrastructureStack/system",
    });
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: "TestInfrastructureStack/runtime/design-systems",
    });
    const applicationSecrets = template.findResources(
      "AWS::SecretsManager::Secret",
    );
    for (const secret of Object.values(applicationSecrets)) {
      expect(secret.Properties).not.toHaveProperty("SecretString");
      expect(secret.Properties).not.toHaveProperty("GenerateSecretString");
    }
    template.hasResourceProperties("AWS::IAM::User", {
      UserName: "TestInfrastructureStack-backend-runtime",
    });
    const policies = template.findResources("AWS::IAM::Policy");
    const runtimePolicy = Object.values(policies).find((policy) =>
      JSON.stringify(policy).includes("ManageGenerationRunObjects"),
    );
    expect(runtimePolicy).toBeDefined();
    const serialized = JSON.stringify(runtimePolicy);
    expect(serialized).toContain("TestInfrastructureStack/runs/*");
    expect(serialized).toContain("/runs/*");
    expect(serialized).toContain("SystemConfigurationSecret");
    expect(serialized).toContain("ReadKolibriSystemConfiguration");
    expect(serialized).toContain("DesignSystemRuntimeSecret");
    expect(serialized).toContain("UpdateDesignSystemRuntimeConfiguration");
    expect(serialized).toContain("secretsmanager:PutSecretValue");
    expect(serialized).not.toContain("secretsmanager:CreateSecret");
    expect(serialized).not.toContain("secretsmanager:DeleteSecret");
    expect(serialized).toContain("ecr:BatchGetImage");
    expect(serialized).toContain("ecr:GetDownloadUrlForLayer");
    expect(serialized).toContain("logs:CreateLogStream");
    expect(serialized).toContain("logs:PutLogEvents");
    expect(serialized).not.toContain("ListGenerationRunPrefix");
    expect(serialized).not.toContain("secretsmanager:DescribeSecret");
    const wildcardStatements =
      runtimePolicy?.Properties.PolicyDocument.Statement.filter(
        (statement: { Resource?: unknown }) => statement.Resource === "*",
      );
    expect(wildcardStatements).toEqual([
      expect.objectContaining({ Action: "ecr:GetAuthorizationToken" }),
    ]);
    template.hasOutput("KolibriSystemSecretNameValue", {
      Value: "TestInfrastructureStack/system",
    });
    template.hasOutput("GenerationStoragePrefixValue", {
      Value: "TestInfrastructureStack",
    });
    template.hasOutput("DesignSystemRuntimeSecretNameValue", {
      Value: "TestInfrastructureStack/runtime/design-systems",
    });
    template.hasOutput("KolibriStackName", {
      Value: "TestInfrastructureStack",
    });
  });

  it("creates a least-privilege frontend publisher and outputs its deployment credentials", () => {
    template.resourceCountIs("AWS::IAM::User", 2);
    template.resourceCountIs("AWS::IAM::AccessKey", 1);
    template.hasOutput("FrontendPublisherAccessKeyId", {
      Value: Match.anyValue(),
    });
    template.hasOutput("FrontendPublisherSecretAccessKey", {
      Value: Match.anyValue(),
    });
    const policies = JSON.stringify(template.findResources("AWS::IAM::Policy"));
    expect(policies).toContain("ListFrontendBucket");
    expect(policies).toContain("PublishFrontendObjects");
    expect(policies).toContain("InvalidateFrontendDistribution");
    expect(policies).toContain("cloudfront:CreateInvalidation");
    expect(policies).toContain(":cloudfront::111111111111:distribution/");
    expect(policies).not.toContain(
      ":cloudfront:us-east-1:111111111111:distribution/",
    );
    expect(policies).toContain("ecr:GetAuthorizationToken");
    expect(policies).toContain("ecr:PutImage");
    expect(policies).toContain("ecr:UploadLayerPart");
  });

  it("creates a retained ECR repository with default encryption and immutable scanned images", () => {
    template.resourceCountIs("AWS::ECR::Repository", 1);
    template.hasResourceProperties("AWS::ECR::Repository", {
      ImageScanningConfiguration: { ScanOnPush: true },
      ImageTagMutability: "IMMUTABLE",
    });
    template.hasResource("AWS::ECR::Repository", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    template.hasOutput("ContainerRepositoryName", { Value: Match.anyValue() });
    template.hasOutput("ContainerRepositoryUri", { Value: Match.anyValue() });
  });

  it("creates a retained backend log group for the on-premises container", () => {
    template.resourceCountIs("AWS::Logs::LogGroup", 1);
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/kolibri/TestInfrastructureStack/backend",
      RetentionInDays: 30,
    });
    template.hasResource("AWS::Logs::LogGroup", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    template.hasOutput("BackendLogGroupName", {
      Value: Match.anyValue(),
    });
  });

  it("does not provision AWS backend or database hosting or expose application secrets", () => {
    for (const resourceType of [
      "AWS::RDS::DBInstance",
      "AWS::RDS::DBCluster",
      "AWS::ECS::Service",
      "AWS::AppRunner::Service",
      "AWS::Lambda::Function",
    ]) {
      template.resourceCountIs(resourceType, 0);
    }
    const outputs = JSON.stringify(template.toJSON().Outputs);
    expect(outputs).not.toContain("clientSecret");
    expect(outputs).not.toContain("GoogleOAuthClientSecret");
    expect(outputs).not.toContain("SecretValue");
  });
});

describe("Kolibri infrastructure configuration", () => {
  it("rejects invalid DNS configuration", () => {
    const app = new cdk.App();
    expect(
      () =>
        new InfrastructureStack(app, "InvalidDnsStack", {
          domainName: "not a domain",
          env: { account: "111111111111", region: "us-east-1" },
          googleOAuthClientId: "test-google-client-id",
          googleOAuthClientSecret: "test-google-client-secret",
          hostedZoneId: "invalid/id",
          kolibriSubdomain: "nested.subdomain",
        }),
    ).toThrow("KOLIBRI_DOMAIN");
  });

  it("rejects deployment outside us-east-1", () => {
    const app = new cdk.App();
    expect(
      () =>
        new InfrastructureStack(app, "WrongRegionStack", {
          domainName: "example.com",
          env: { account: "111111111111", region: "us-west-2" },
          googleOAuthClientId: "test-google-client-id",
          googleOAuthClientSecret: "test-google-client-secret",
          hostedZoneId: "Z1111111111111",
          kolibriSubdomain: "kolibri",
        }),
    ).toThrow("us-east-1");
  });
});
