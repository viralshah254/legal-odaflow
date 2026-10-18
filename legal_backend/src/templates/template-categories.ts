export const TEMPLATE_CATEGORY = {
  GENERAL: 'GENERAL_TEMPLATE',
  CLIENT: 'CLIENT_DOCUMENT',
  USER: 'USER_TEMPLATE',
} as const;

export type TemplateCategory =
  (typeof TEMPLATE_CATEGORY)[keyof typeof TEMPLATE_CATEGORY];

export function isClientTemplateCategory(category: string | null | undefined): boolean {
  return category === 'CLIENT_DOCUMENT' || category === 'CLIENT';
}

export function isUserTemplateCategory(category: string | null | undefined): boolean {
  return category === TEMPLATE_CATEGORY.USER;
}

export function isGeneralTemplateCategory(category: string | null | undefined): boolean {
  if (!category) return true;
  return !isClientTemplateCategory(category) && !isUserTemplateCategory(category);
}

export function canManageTemplateDeletion(options: {
  category: string | null | undefined;
  createdByUserId: string | null | undefined;
  userId: string;
  tenantRole?: string;
}): boolean {
  const { category, createdByUserId, userId, tenantRole } = options;
  if (!isUserTemplateCategory(category)) return true;
  if (createdByUserId === userId) return true;
  return tenantRole === 'FIRM_ADMIN' || tenantRole === 'PARTNER';
}
