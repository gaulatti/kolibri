import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface IamResources {
  readonly backendRuntimeUser: iam.User;
  readonly frontendPublisher: iam.User;
  readonly frontendPublisherAccessKey: iam.CfnAccessKey;
}

export interface IamProps {
  readonly stackNamespace: string;
  readonly generationStoragePrefix: string;
  readonly designSystemRuntimeSecret: secretsmanager.CfnSecret;
  readonly generationBucket: s3.Bucket;
  readonly frontendBucket: s3.Bucket;
  readonly systemSecret: secretsmanager.CfnSecret;
  readonly distribution: cloudfront.Distribution;
  readonly containerRepository: ecr.Repository;
  readonly backendLogGroup: logs.LogGroup;
}

export function createIamResources(
  scope: Construct,
  props: IamProps,
): IamResources {
  const backendRuntimeUser = new iam.User(scope, "BackendRuntimeUser", {
    userName: `${props.stackNamespace}-backend-runtime`,
  });
  backendRuntimeUser.addToPolicy(
    new iam.PolicyStatement({
      sid: "ManageGenerationRunObjects",
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [
        props.generationBucket.arnForObjects(
          `${props.generationStoragePrefix}/runs/*`,
        ),
      ],
    }),
  );
  backendRuntimeUser.addToPolicy(
    new iam.PolicyStatement({
      sid: "ReadKolibriSystemConfiguration",
      actions: ["secretsmanager:GetSecretValue"],
      resources: [props.systemSecret.attrId],
    }),
  );
  backendRuntimeUser.addToPolicy(
    new iam.PolicyStatement({
      sid: "UpdateDesignSystemRuntimeConfiguration",
      actions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
      ],
      resources: [props.designSystemRuntimeSecret.attrId],
    }),
  );
  props.containerRepository.grantPull(backendRuntimeUser);
  props.backendLogGroup.grantWrite(backendRuntimeUser);

  const frontendPublisher = new iam.User(scope, "FrontendPublisher", {
    userName: `${props.stackNamespace}-frontend-publisher`,
  });
  frontendPublisher.addToPolicy(
    new iam.PolicyStatement({
      sid: "ListFrontendBucket",
      actions: ["s3:GetBucketLocation", "s3:ListBucket"],
      resources: [props.frontendBucket.bucketArn],
    }),
  );
  props.containerRepository.grantPush(frontendPublisher);
  frontendPublisher.addToPolicy(
    new iam.PolicyStatement({
      sid: "PublishFrontendObjects",
      actions: ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
      resources: [props.frontendBucket.arnForObjects("*")],
    }),
  );
  frontendPublisher.addToPolicy(
    new iam.PolicyStatement({
      sid: "InvalidateFrontendDistribution",
      actions: ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      resources: [props.distribution.distributionArn],
    }),
  );

  const frontendPublisherAccessKey = new iam.CfnAccessKey(
    scope,
    "FrontendPublisherAccessKey",
    { userName: frontendPublisher.userName },
  );

  return {
    backendRuntimeUser,
    frontendPublisher,
    frontendPublisherAccessKey,
  };
}
