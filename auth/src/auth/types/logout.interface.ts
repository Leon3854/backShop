export interface LogoutResult {
  message: string;
  timestamp: string;
  success: boolean;
}

export interface LogoutContext {
  accessToken?: string;
  tokenExpiry?: number;
  userAgent?: string;
  ipAddress?: string;
}
