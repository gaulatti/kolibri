import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthenticationResources {
  readonly hostedDomainUrl: string;
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly userPoolDomain: cognito.UserPoolDomain;
}

export interface AuthenticationProps {
  readonly frontendCallbackUrl: string;
  readonly frontendLogoutUrl: string;
  readonly googleOAuthClientId: string;
  readonly googleOAuthClientSecret: string;
  readonly kolibriSubdomain: string;
}

export function createAuthentication(scope: Construct, props: AuthenticationProps): AuthenticationResources {
  const stack = cdk.Stack.of(scope);
  const cognitoDomainPrefix = `${props.kolibriSubdomain}-${stack.account}`;

  const userPool = new cognito.UserPool(scope, 'UserPool', {
    accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    deletionProtection: true,
    featurePlan: cognito.FeaturePlan.ESSENTIALS,
    selfSignUpEnabled: false,
    signInAliases: { email: true },
    standardAttributes: {
      email: { required: true, mutable: true }
    },
    removalPolicy: cdk.RemovalPolicy.RETAIN
  });
  const googleProvider = new cognito.UserPoolIdentityProviderGoogle(scope, 'GoogleProvider', {
    userPool,
    clientId: props.googleOAuthClientId,
    clientSecretValue: cdk.SecretValue.unsafePlainText(props.googleOAuthClientSecret),
    scopes: ['openid', 'email', 'profile'],
    attributeMapping: {
      email: cognito.ProviderAttribute.GOOGLE_EMAIL,
      fullname: cognito.ProviderAttribute.GOOGLE_NAME
    }
  });
  const userPoolClient = userPool.addClient('FrontendAppClient', {
    authFlows: { userSrp: true },
    disableOAuth: false,
    enableTokenRevocation: true,
    generateSecret: false,
    oAuth: {
      callbackUrls: [
        props.frontendCallbackUrl,
        'http://localhost:5173/auth/callback',
        'http://localhost:5188/auth/callback',
        'https://kolibri.dev/auth/callback'
      ],
      logoutUrls: [
        props.frontendLogoutUrl,
        'http://localhost:5173/sign-in?signedOut=1',
        'http://localhost:5188/sign-in?signedOut=1',
        'https://kolibri.dev/sign-in?signedOut=1'
      ],
      flows: { authorizationCodeGrant: true },
      scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE]
    },
    preventUserExistenceErrors: true,
    supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
    accessTokenValidity: cdk.Duration.hours(1),
    idTokenValidity: cdk.Duration.hours(1),
    refreshTokenValidity: cdk.Duration.days(30)
  });
  userPoolClient.node.addDependency(googleProvider);
  const userPoolDomain = userPool.addDomain('HostedDomain', {
    cognitoDomain: { domainPrefix: cognitoDomainPrefix }
  });

  return {
    hostedDomainUrl: userPoolDomain.baseUrl(),
    userPool,
    userPoolClient,
    userPoolDomain,
  };
}
