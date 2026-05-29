export interface RequestUser {
  id: string;
  email: string;
  name: string | null;
  userType: string;
  countryCode: string | null;
  tenantId?: string;
  tenantRole?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  userType: string;
  tenantId?: string;
  tenantRole?: string;
}
