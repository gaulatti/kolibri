import * as cdk from 'aws-cdk-lib/core';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface ComputeResources {
  readonly containerRepository: ecr.Repository;
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
  return { containerRepository };
}
