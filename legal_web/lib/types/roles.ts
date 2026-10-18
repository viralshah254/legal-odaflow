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

import type { CopilotPermission } from "./copilot"

/** Meeting/transcript permissions per spec */
export interface MeetingPermissions {
  meetingsRead: boolean
  meetingsRecord: boolean
  meetingsUpload: boolean
  meetingsEdit: boolean
  meetingsDelete: boolean
  transcriptsRead: boolean
  transcriptsEdit: boolean
  notesRead: boolean
  notesEdit: boolean
  meetingsConnectProviders: boolean
  meetingsExport: boolean
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
  /** Meeting transcript tool */
  meetingPermissions: MeetingPermissions
  /** Copilot: use chat, drafts, execute actions, approve actions, finance actions, client/matter/data access */
  copilotPermissions: CopilotPermission[]
}

const CP = {
  chat: "canUseCopilotChat" as const,
  drafts: "canUseCopilotDrafts" as const,
  actions: "canUseCopilotActions" as const,
  approve: "canApproveCopilotActions" as const,
  finance: "canUseCopilotFinanceActions" as const,
  clientData: "canUseCopilotClientData" as const,
  matterData: "canUseCopilotMatterData" as const,
  documentSearch: "canUseCopilotDocumentSearch" as const,
  adminSettings: "canUseCopilotAdminSettings" as const,
}

const MP = (p: Partial<MeetingPermissions>): MeetingPermissions => ({
  meetingsRead: false,
  meetingsRecord: false,
  meetingsUpload: false,
  meetingsEdit: false,
  meetingsDelete: false,
  transcriptsRead: false,
  transcriptsEdit: false,
  notesRead: false,
  notesEdit: false,
  meetingsConnectProviders: false,
  meetingsExport: false,
  ...p,
})

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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: true,
      meetingsUpload: true,
      meetingsEdit: true,
      meetingsDelete: true,
      transcriptsRead: true,
      transcriptsEdit: true,
      notesRead: true,
      notesEdit: true,
      meetingsConnectProviders: true,
      meetingsExport: true,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.actions, CP.approve, CP.finance, CP.clientData, CP.matterData, CP.documentSearch, CP.adminSettings],
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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: true,
      meetingsUpload: true,
      meetingsEdit: true,
      meetingsDelete: false,
      transcriptsRead: true,
      transcriptsEdit: true,
      notesRead: true,
      notesEdit: true,
      meetingsConnectProviders: false,
      meetingsExport: true,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.actions, CP.approve, CP.clientData, CP.matterData, CP.documentSearch],
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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: true,
      meetingsUpload: true,
      meetingsEdit: true,
      meetingsDelete: false,
      transcriptsRead: true,
      transcriptsEdit: true,
      notesRead: true,
      notesEdit: true,
      meetingsConnectProviders: false,
      meetingsExport: false,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.actions, CP.clientData, CP.matterData],
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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: false,
      meetingsUpload: true,
      meetingsEdit: false,
      meetingsDelete: false,
      transcriptsRead: true,
      transcriptsEdit: false,
      notesRead: true,
      notesEdit: false,
      meetingsConnectProviders: false,
      meetingsExport: false,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.actions, CP.matterData],
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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: false,
      meetingsUpload: false,
      meetingsEdit: false,
      meetingsDelete: false,
      transcriptsRead: false,
      transcriptsEdit: false,
      notesRead: true,
      notesEdit: false,
      meetingsConnectProviders: false,
      meetingsExport: false,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.finance, CP.clientData],
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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: true,
      meetingsUpload: true,
      meetingsEdit: false,
      meetingsDelete: false,
      transcriptsRead: true,
      transcriptsEdit: false,
      notesRead: true,
      notesEdit: false,
      meetingsConnectProviders: false,
      meetingsExport: false,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.actions, CP.clientData, CP.matterData],
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
    meetingPermissions: MP({}),
    copilotPermissions: [CP.chat, CP.drafts],
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
    meetingPermissions: MP({
      meetingsRead: false,
      meetingsRecord: true,
      meetingsUpload: false,
      meetingsEdit: false,
      meetingsDelete: false,
      transcriptsRead: false,
      transcriptsEdit: false,
      notesRead: false,
      notesEdit: false,
      meetingsConnectProviders: false,
      meetingsExport: false,
    }),
    copilotPermissions: [CP.chat, CP.drafts, CP.clientData],
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
    meetingPermissions: MP({
      meetingsRead: true,
      meetingsRecord: false,
      meetingsUpload: false,
      meetingsEdit: false,
      meetingsDelete: false,
      transcriptsRead: true,
      transcriptsEdit: false,
      notesRead: true,
      notesEdit: false,
      meetingsConnectProviders: false,
      meetingsExport: false,
    }),
    copilotPermissions: [CP.chat],
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

export function hasCopilotPermission(role: UserRole, permission: CopilotPermission): boolean {
  return ROLE_PERMISSIONS[role].copilotPermissions.includes(permission)
}

export function hasMeetingPermission(
  role: UserRole,
  permission: keyof MeetingPermissions
): boolean {
  return ROLE_PERMISSIONS[role].meetingPermissions[permission] === true
}




