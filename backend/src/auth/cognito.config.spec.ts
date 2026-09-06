import { loadCognitoConfiguration } from './cognito.config';

describe('Cognito configuration', () => {
  const environment: NodeJS.ProcessEnv = {
    AWS_REGION: 'us-east-1',
    COGNITO_USER_POOL_ID: 'us-east-1_examplePool',
    COGNITO_APP_CLIENT_ID: 'example-client-id',
  };

  it('loads sanitized Cognito identifiers from the environment', () => {
    expect(loadCognitoConfiguration(environment)).toEqual({
      awsRegion: 'us-east-1',
      userPoolId: 'us-east-1_examplePool',
      appClientId: 'example-client-id',
    });
  });

  it('rejects missing or cross-region configuration without echoing values', () => {
    expect(() =>
      loadCognitoConfiguration({
        ...environment,
        COGNITO_APP_CLIENT_ID: undefined,
      }),
    ).toThrow('COGNITO_APP_CLIENT_ID');
    expect(() =>
      loadCognitoConfiguration({
        ...environment,
        COGNITO_USER_POOL_ID: 'us-west-2_examplePool',
      }),
    ).toThrow('COGNITO_USER_POOL_ID must belong to AWS_REGION');
    expect(() =>
      loadCognitoConfiguration({ ...environment, AWS_REGION: 'invalid' }),
    ).toThrow('AWS_REGION must be a valid AWS region identifier');
  });
});
