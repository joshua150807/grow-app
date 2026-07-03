export type AuthUser = {
  id: string;
  email: string | null;
  role: string | null;
};

export type AuthTokenVerifier = (token: string) => Promise<AuthUser | null>;
