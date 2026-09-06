import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cdk from 'aws-cdk-lib/core';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface FrontendHostingResources {
  readonly certificate: acm.Certificate;
  readonly distribution: cloudfront.Distribution;
}

export interface FrontendHostingProps {
  readonly domainName: string;
  readonly hostedZoneId: string;
  readonly kolibriSubdomain: string;
  readonly fqdn: string;
  readonly frontendBucket: s3.Bucket;
}

export function createFrontendHosting(
  scope: Construct,
  props: FrontendHostingProps,
): FrontendHostingResources {
  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(scope, 'HostedZone', {
    hostedZoneId: props.hostedZoneId,
    zoneName: props.domainName,
  });
  const certificate = new acm.Certificate(scope, 'FrontendCertificate', {
    domainName: props.fqdn,
    validation: acm.CertificateValidation.fromDns(hostedZone),
  });
  const distribution = new cloudfront.Distribution(scope, 'FrontendDistribution', {
    certificate,
    defaultRootObject: 'index.html',
    domainNames: [props.fqdn],
    httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(props.frontendBucket),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    errorResponses: [403, 404].map((httpStatus) => ({
      httpStatus,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.seconds(0),
    })),
  });

  new route53.ARecord(scope, 'FrontendAliasA', {
    zone: hostedZone,
    recordName: props.kolibriSubdomain,
    target: route53.RecordTarget.fromAlias(
      new route53Targets.CloudFrontTarget(distribution),
    ),
  });
  new route53.AaaaRecord(scope, 'FrontendAliasAaaa', {
    zone: hostedZone,
    recordName: props.kolibriSubdomain,
    target: route53.RecordTarget.fromAlias(
      new route53Targets.CloudFrontTarget(distribution),
    ),
  });

  return { certificate, distribution };
}
