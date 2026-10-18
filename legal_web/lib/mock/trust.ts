import type { TrustAccount, TrustTransaction, TrustTransactionType, TrustTransactionStatus } from "@/lib/types"
import { mockMatters } from "@/lib/mock/matters"
import { getClientById } from "@/lib/mock/clients"

const STORAGE_KEY_ACCOUNTS = "odaflow_trust_accounts"
const STORAGE_KEY_TXNS = "odaflow_trust_transactions"

interface TrustAccountRecord {
  id: string
  clientId: string
  matterId: string
  balance: number
  createdAt: Date
}

interface TrustTransactionRecord {
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

let accounts: TrustAccountRecord[] = []
let transactions: TrustTransactionRecord[] = []

function loadAccounts(): TrustAccountRecord[] {
  if (typeof window === "undefined") {
    return mockMatters.slice(0, 4).map((m) => ({
      id: `trust-${m.id}`,
      clientId: m.clientId,
      matterId: m.id,
      balance: [150000, 80000, 200000, 25000][mockMatters.indexOf(m) % 4] ?? 0,
      createdAt: new Date(),
    }))
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS)
    if (!raw) {
      accounts = mockMatters.slice(0, 4).map((m, i) => ({
        id: `trust-${m.id}`,
        clientId: m.clientId,
        matterId: m.id,
        balance: [150000, 80000, 200000, 25000][i] ?? 0,
        createdAt: new Date(),
      }))
      saveAccounts()
      return [...accounts]
    }
    accounts = JSON.parse(raw).map((a: TrustAccountRecord) => ({
      ...a,
      createdAt: new Date(a.createdAt),
    }))
    return accounts
  } catch {
    return accounts.length ? accounts : loadAccounts()
  }
}

function saveAccounts() {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts))
}

function loadTransactions(): TrustTransactionRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TXNS)
    if (!raw) return []
    transactions = JSON.parse(raw).map((t: TrustTransactionRecord) => ({
      ...t,
      approvedAt: t.approvedAt ? new Date(t.approvedAt) : undefined,
      createdAt: new Date(t.createdAt),
    }))
    return transactions
  } catch {
    return transactions
  }
}

function saveTransactions() {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY_TXNS, JSON.stringify(transactions))
}

function ensureAccounts() {
  if (accounts.length === 0) loadAccounts()
  if (accounts.length === 0) {
    accounts = mockMatters.slice(0, 4).map((m, i) => ({
      id: `trust-${m.id}`,
      clientId: m.clientId,
      matterId: m.id,
      balance: [150000, 80000, 200000, 25000][i] ?? 0,
      createdAt: new Date(),
    }))
    saveAccounts()
  }
}

export function getTrustAccounts(): TrustAccount[] {
  ensureAccounts()
  const txns = loadTransactions()
  return accounts.map((a) => {
    const client = getClientById(a.clientId)
    const matter = mockMatters.find((m) => m.id === a.matterId)
    const accountTxns = txns
      .filter((t) => t.accountId === a.id)
      .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
    return {
      id: a.id,
      clientId: a.clientId,
      client: client ? { id: client.id, name: client.name } as any : undefined,
      matterId: a.matterId,
      matter: matter ? { id: matter.id, title: matter.title } as any : undefined,
      balance: a.balance,
      transactions: accountTxns.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        type: t.type,
        amount: t.amount,
        description: t.description,
        status: t.status,
        requestedBy: t.requestedBy,
        approvedBy: t.approvedBy,
        approvedAt: t.approvedAt,
        createdAt: t.createdAt,
      })),
    }
  })
}

export function getTrustAccountById(id: string): TrustAccount | undefined {
  return getTrustAccounts().find((a) => a.id === id)
}

export function getPendingDisbursements(): TrustTransaction[] {
  const txns = loadTransactions()
  return txns
    .filter((t) => t.type === "DISBURSEMENT" && t.status === "PENDING")
    .map((t) => {
      const acc = accounts.find((a) => a.id === t.accountId)
      const matter = acc ? mockMatters.find((m) => m.id === acc.matterId) : null
      return {
        ...t,
        approvedAt: t.approvedAt,
      } as TrustTransaction
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function createDeposit(
  accountId: string,
  amount: number,
  description: string,
  requestedBy: string
): TrustTransactionRecord | null {
  ensureAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc || amount <= 0) return null
  const txn: TrustTransactionRecord = {
    id: `txn-${Date.now()}`,
    accountId,
    type: "DEPOSIT",
    amount,
    description,
    status: "COMPLETED",
    requestedBy,
    createdAt: new Date(),
  }
  transactions.push(txn)
  acc.balance += amount
  saveAccounts()
  saveTransactions()
  return txn
}

export function createDisbursement(
  accountId: string,
  amount: number,
  description: string,
  requestedBy: string
): TrustTransactionRecord | null {
  ensureAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc || amount <= 0) return null
  if (acc.balance < amount) return null
  const txn: TrustTransactionRecord = {
    id: `txn-${Date.now()}`,
    accountId,
    type: "DISBURSEMENT",
    amount,
    description,
    status: "PENDING",
    requestedBy,
    createdAt: new Date(),
  }
  transactions.push(txn)
  saveTransactions()
  return txn
}

export function approveDisbursement(transactionId: string, approvedBy: string): TrustTransactionRecord | null {
  const txn = transactions.find((t) => t.id === transactionId && t.type === "DISBURSEMENT" && t.status === "PENDING")
  if (!txn) return null
  const acc = accounts.find((a) => a.id === txn.accountId)
  if (!acc || acc.balance < txn.amount) return null
  acc.balance -= txn.amount
  txn.status = "COMPLETED"
  txn.approvedBy = approvedBy
  txn.approvedAt = new Date()
  saveAccounts()
  saveTransactions()
  return txn
}

export function rejectDisbursement(transactionId: string): TrustTransactionRecord | null {
  const txn = transactions.find((t) => t.id === transactionId && t.type === "DISBURSEMENT" && t.status === "PENDING")
  if (!txn) return null
  txn.status = "REJECTED"
  saveTransactions()
  return txn
}
