export type SystemRole = 
  | 'SUPER_ADMIN'
  | 'FIRM_OWNER'
  | 'FIRM_ADMIN'
  | 'ADVOCATE'
  | 'PARALEGAL'
  | 'ACCOUNTANT'
  | 'CLIENT_PORTAL_USER'

export type ClientType = 'INDIVIDUAL' | 'COMPANY' | 'NGO' | 'PARTNERSHIP'

export type MatterType = 'CONVEYANCING' | 'LITIGATION' | 'CORPORATE' | 'PROBATE' | 'EMPLOYMENT'

export type MatterStage = 
  | 'INTAKE'
  | 'CONFLICT_CHECK'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'CLOSED'

export type MatterStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED'

export type TaskPriority = 'LOW' | 'STANDARD' | 'HIGH' | 'CRITICAL'

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export type KYCStatus = 'MISSING' | 'UPLOADED' | 'VERIFIED' | 'EXPIRED'

export type TrustTransactionType = 'DEPOSIT' | 'DISBURSEMENT'

export type TrustTransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export interface User {
  id: string
  email: string
  name: string
  role: SystemRole
  firmId: string
  avatar?: string
}

export interface Client {
  id: string
  name: string
  type: ClientType
  email: string
  phone?: string
  address?: {
    street: string
    city: string
    state: string
    country: string
    zipCode: string
  }
  kycStatus: KYCStatus
  tags: string[]
  portalEnabled: boolean
  notificationsEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Matter {
  id: string
  ref: string
  title: string
  clientId: string
  client?: Client
  type: MatterType
  stage: MatterStage
  status: MatterStatus
  advocateId?: string
  advocate?: User
  adminId?: string
  admin?: User
  parties: MatterParty[]
  keyDates: KeyDate[]
  nextDeadline?: Date
  createdAt: Date
  updatedAt: Date
}

export interface MatterParty {
  id: string
  name: string
  role: string
  type: 'CLIENT' | 'OPPOSING' | 'THIRD_PARTY'
}

export interface KeyDate {
  id: string
  label: string
  date: Date
  type: 'HEARING' | 'FILING' | 'LIMITATION' | 'OTHER'
}

export interface Task {
  id: string
  title: string
  description?: string
  matterId?: string
  matter?: Matter
  clientId?: string
  client?: Client
  dueDate: Date
  priority: TaskPriority
  status: TaskStatus
  assigneeId?: string
  assignee?: User
  watcherIds: string[]
  category: string
  dependencies: string[]
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  name: string
  type: string
  matterId?: string
  matter?: Matter
  clientId?: string
  client?: Client
  uploadedBy: string
  uploadedAt: Date
  size: number
  version: number
  versions: DocumentVersion[]
  approvedForPortal: boolean
  approvedBy?: string
  approvedAt?: Date
}

export interface DocumentVersion {
  version: number
  uploadedAt: Date
  uploadedBy: string
  size: number
}

export interface Invoice {
  id: string
  number: string
  clientId: string
  client?: Client
  matterId?: string
  matter?: Matter
  status: InvoiceStatus
  issueDate: Date
  dueDate: Date
  lineItems: InvoiceLineItem[]
  subtotal: number
  tax: number
  total: number
  paidAmount: number
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface TrustAccount {
  id: string
  clientId: string
  client?: Client
  matterId?: string
  matter?: Matter
  balance: number
  transactions: TrustTransaction[]
}

export interface TrustTransaction {
  id: string
  accountId: string
  type: TrustTransactionType
  amount: number
  description: string
  status: TrustTransactionStatus
  requestedBy: string
  approvedBy?: string
  approvedAt?: Date
  createdAt: Date
}

export interface Notification {
  id: string
  type: 'TASK_DUE' | 'TASK_OVERDUE' | 'KYC_EXPIRED' | 'INVOICE_OVERDUE' | 'TRUST_APPROVAL' | 'MENTION'
  title: string
  message: string
  userId: string
  read: boolean
  link?: string
  createdAt: Date
}

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger: string
  conditions: Record<string, any>
  actions: Record<string, any>
}




