import { Prisma } from '@prisma/client';

/** Active firm membership used when issuing auth tokens. */
export const authTenantMembershipSelect = {
  where: { status: 'ACTIVE' as const },
  orderBy: { createdAt: 'asc' as const },
  take: 1,
  select: { tenantId: true, role: true },
} satisfies Prisma.User$tenantUsersArgs;

/** Core user fields returned in auth responses. */
export const authUserCoreSelect = {
  id: true,
  email: true,
  name: true,
  userType: true,
  countryCode: true,
  mustChangePassword: true,
} satisfies Prisma.UserSelect;

/** Login / refresh / token issue — includes tenant membership. */
export const authUserSessionSelect = {
  ...authUserCoreSelect,
  tenantUsers: authTenantMembershipSelect,
} satisfies Prisma.UserSelect;

/** Password login — adds credential + active checks. */
export const authUserLoginSelect = {
  ...authUserCoreSelect,
  passwordHash: true,
  isActive: true,
  tenantUsers: authTenantMembershipSelect,
} satisfies Prisma.UserSelect;

/** Change-password flow — needs phone for breach-check context. */
export const authUserPasswordChangeSelect = {
  ...authUserCoreSelect,
  phone: true,
  passwordHash: true,
  tenantUsers: authTenantMembershipSelect,
} satisfies Prisma.UserSelect;

export type AuthUserSession = Prisma.UserGetPayload<{
  select: typeof authUserSessionSelect;
}>;

export type AuthUserLoginRecord = Prisma.UserGetPayload<{
  select: typeof authUserLoginSelect;
}>;

export type AuthUserPasswordChangeRecord = Prisma.UserGetPayload<{
  select: typeof authUserPasswordChangeSelect;
}>;

export function buildPasswordChangeUpdate(passwordHash: string): Prisma.UserUpdateInput {
  return {
    passwordHash,
    mustChangePassword: false,
  };
}
