import * as cdk from 'aws-cdk-lib/core';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ComputeResources {
  readonly containerRepository: ecr.Repository;
  readonly backendLogGroup: logs.LogGroup;
}

export function createComputeResources(
  scope: Construct,
  stackNamespace: string,
): ComputeResources {
  const containerRepository = new ecr.Repository(scope, 'ContainerRepository', {
    encryption: ecr.RepositoryEncryption.AES_256,
    imageScanOnPush: true,
    imageTagMutability: ecr.TagMutability.IMMUTABLE,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });
  const backendLogGroup = new logs.LogGroup(scope, 'BackendLogGroup', {
    logGroupName: `/kolibri/${stackNamespace}/backend`,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    retention: logs.RetentionDays.ONE_MONTH,
  });

  return { containerRepository, backendLogGroup };
}
