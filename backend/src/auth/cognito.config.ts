export type CognitoConfiguration = {
  awsRegion: string;
  userPoolId: string;
  appClientId: string;
};

function required(
  environment: NodeJS.ProcessEnv,
  variableName: string,
): string {
  const value = environment[variableName]?.trim();
  if (!value) {
    throw new Error(
      `Missing required Cognito environment variable: ${variableName}`,
    );
  }
  return value;
}

export function loadCognitoConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): CognitoConfiguration {
  const awsRegion = required(environment, 'AWS_REGION');
  const userPoolId = required(environment, 'COGNITO_USER_POOL_ID');
  const appClientId = required(environment, 'COGNITO_APP_CLIENT_ID');
  const poolRegion = userPoolId.split('_', 1)[0];

  if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d$/.test(awsRegion)) {
    throw new Error('AWS_REGION must be a valid AWS region identifier');
  }
  if (!userPoolId.includes('_') || poolRegion !== awsRegion) {
    throw new Error('COGNITO_USER_POOL_ID must belong to AWS_REGION');
  }

  return { awsRegion, userPoolId, appClientId };
}
