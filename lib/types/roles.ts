export type UserRole =
  | "PARTNER_ADMIN"
  | "JUNIOR_PARTNER"
  | "ASSOCIATE"
  | "PARALEGAL"
  | "FINANCE"
  | "INTAKE"
  | "OPS_HR"
  | "RECEPTION"
  | "READ_ONLY"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  teamId?: string
  teamName?: string
  avatar?: string
  lastActivity?: Date
}

export interface RolePermissions {
  canViewAllMatters: boolean
  canViewTeam: boolean
  canViewFinance: boolean
  canCreateMatter: boolean
  canAssignTasks: boolean
  canViewAllTasks: boolean
  canViewAllCalendar: boolean
  canManageSettings: boolean
  canApproveTrust: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  PARTNER_ADMIN: {
    canViewAllMatters: true,
    canViewTeam: true,
    canViewFinance: true,
    canCreateMatter: true,
    canAssignTasks: true,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: true,
    canApproveTrust: true,
  },
  JUNIOR_PARTNER: {
    canViewAllMatters: false,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: true,
    canAssignTasks: true,
    canViewAllTasks: false,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
  ASSOCIATE: {
    canViewAllMatters: false,
    canViewTeam: false,
    canViewFinance: false,
    canCreateMatter: true,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: false,
  },
  PARALEGAL: {
    canViewAllMatters: false,
    canViewTeam: false,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: false,
  },
  FINANCE: {
    canViewAllMatters: true,
    canViewTeam: false,
    canViewFinance: true,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: false,
  },
  INTAKE: {
    canViewAllMatters: false,
    canViewTeam: false,
    canViewFinance: false,
    canCreateMatter: true,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: false,
  },
  OPS_HR: {
    canViewAllMatters: false,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
  RECEPTION: {
    canViewAllMatters: false,
    canViewTeam: false,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: false,
  },
  READ_ONLY: {
    canViewAllMatters: true,
    canViewTeam: true,
    canViewFinance: true,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
}

export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role]
}

export function canViewAllMatters(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role].canViewAllMatters
}

export function canViewTeam(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role].canViewTeam
}

export function canViewFinance(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role].canViewFinance
}

