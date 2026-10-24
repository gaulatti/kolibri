import type { Request } from 'express';

export type AuthenticatedUser = {
  userReferenceId: string;
  cognitoSub: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
