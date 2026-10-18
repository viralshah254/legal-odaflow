import { delay } from './utils'
import {
  mockUsers,
  mockClients,
  mockMatters,
  mockTasks,
  mockDocuments,
  mockInvoices,
  mockTrustAccounts,
  mockNotifications,
  mockAutomationRules,
} from './mock-data'
import type {
  User,
  Client,
  Matter,
  Task,
  Document,
  Invoice,
  TrustAccount,
  TrustTransaction,
  Notification,
  AutomationRule,
} from './types'

// Simulate API delay
const apiDelay = () => delay(300 + Math.random() * 500)

// Auth API
export const authApi = {
  async login(email: string, password: string): Promise<User> {
    await apiDelay()
    const user = mockUsers.find(u => u.email === email)
    if (!user || password !== 'password') {
      throw new Error('Invalid credentials')
    }
    return user
  },

  async loginWithOTP(email: string, otp: string): Promise<User> {
    await apiDelay()
    const user = mockUsers.find(u => u.email === email)
    if (!user) {
      throw new Error('User not found')
    }
    // Demo OTP code is 111111
    if (otp !== '111111') {
      throw new Error('Invalid OTP code')
    }
    return user
  },

  async getCurrentUser(): Promise<User | null> {
    await apiDelay()
    return mockUsers[0] // Return first user as current
  },

  async logout(): Promise<void> {
    await apiDelay()
  },
}

// Clients API
export const clientsApi = {
  async listClients(filters?: any): Promise<Client[]> {
    await apiDelay()
    let clients = [...mockClients]
    
    if (filters?.type) {
      clients = clients.filter(c => c.type === filters.type)
    }
    if (filters?.kycStatus) {
      clients = clients.filter(c => c.kycStatus === filters.kycStatus)
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase()
      clients = clients.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search)
      )
    }
    
    return clients
  },

  async getClient(id: string): Promise<Client> {
    await apiDelay()
    const client = mockClients.find(c => c.id === id)
    if (!client) throw new Error('Client not found')
    return client
  },

  async createClient(data: Partial<Client>): Promise<Client> {
    await apiDelay()
    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: data.name || '',
      type: data.type || 'INDIVIDUAL',
      email: data.email || '',
      phone: data.phone,
      address: data.address,
      kycStatus: 'MISSING',
      tags: data.tags || [],
      portalEnabled: data.portalEnabled || false,
      notificationsEnabled: data.notificationsEnabled || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockClients.push(newClient)
    return newClient
  },

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    await apiDelay()
    const index = mockClients.findIndex(c => c.id === id)
    if (index === -1) throw new Error('Client not found')
    mockClients[index] = { ...mockClients[index], ...data, updatedAt: new Date() }
    return mockClients[index]
  },
}

// Matters API
export const mattersApi = {
  async listMatters(filters?: any): Promise<Matter[]> {
    await apiDelay()
    let matters = [...mockMatters]
    
    if (filters?.type) {
      matters = matters.filter(m => m.type === filters.type)
    }
    if (filters?.status) {
      matters = matters.filter(m => m.status === filters.status)
    }
    if (filters?.stage) {
      matters = matters.filter(m => m.stage === filters.stage)
    }
    
    return matters
  },

  async getMatter(id: string): Promise<Matter> {
    await apiDelay()
    const matter = mockMatters.find(m => m.id === id)
    if (!matter) throw new Error('Matter not found')
    return matter
  },

  async createMatter(data: Partial<Matter>): Promise<Matter> {
    await apiDelay()
    const newMatter: Matter = {
      id: `matter-${Date.now()}`,
      ref: data.ref || `MAT-${new Date().getFullYear()}-${String(mockMatters.length + 1).padStart(3, '0')}`,
      title: data.title || '',
      clientId: data.clientId || '',
      type: data.type || 'CORPORATE',
      stage: 'INTAKE',
      status: 'ACTIVE',
      advocateId: data.advocateId,
      adminId: data.adminId,
      parties: data.parties || [],
      keyDates: data.keyDates || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockMatters.push(newMatter)
    return newMatter
  },

  async updateMatter(id: string, data: Partial<Matter>): Promise<Matter> {
    await apiDelay()
    const index = mockMatters.findIndex(m => m.id === id)
    if (index === -1) throw new Error('Matter not found')
    mockMatters[index] = { ...mockMatters[index], ...data, updatedAt: new Date() }
    return mockMatters[index]
  },

  async updateMatterStage(id: string, stage: Matter['stage']): Promise<Matter> {
    await apiDelay()
    return this.updateMatter(id, { stage })
  },
}

// Tasks API
export const tasksApi = {
  async listTasks(filters?: any): Promise<Task[]> {
    await apiDelay()
    let tasks = [...mockTasks]
    
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status)
    }
    if (filters?.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority)
    }
    if (filters?.assigneeId) {
      tasks = tasks.filter(t => t.assigneeId === filters.assigneeId)
    }
    if (filters?.overdue) {
      const now = new Date()
      tasks = tasks.filter(t => t.dueDate < now && t.status !== 'COMPLETED')
    }
    if (filters?.dueToday) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tasks = tasks.filter(t => {
        const due = new Date(t.dueDate)
        return due >= today && due < tomorrow && t.status !== 'COMPLETED'
      })
    }
    
    return tasks
  },

  async getTask(id: string): Promise<Task> {
    await apiDelay()
    const task = mockTasks.find(t => t.id === id)
    if (!task) throw new Error('Task not found')
    return task
  },

  async createTask(data: Partial<Task>): Promise<Task> {
    await apiDelay()
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: data.title || '',
      description: data.description,
      matterId: data.matterId,
      clientId: data.clientId,
      dueDate: data.dueDate || new Date(),
      priority: data.priority || 'STANDARD',
      status: 'PENDING',
      assigneeId: data.assigneeId,
      watcherIds: data.watcherIds || [],
      category: data.category || 'STANDARD',
      dependencies: data.dependencies || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockTasks.push(newTask)
    return newTask
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    await apiDelay()
    const index = mockTasks.findIndex(t => t.id === id)
    if (index === -1) throw new Error('Task not found')
    mockTasks[index] = { ...mockTasks[index], ...data, updatedAt: new Date() }
    if (data.status === 'COMPLETED') {
      mockTasks[index].completedAt = new Date()
    }
    return mockTasks[index]
  },
}

// Documents API
export const documentsApi = {
  async listDocuments(filters?: any): Promise<Document[]> {
    await apiDelay()
    let documents = [...mockDocuments]
    
    if (filters?.matterId) {
      documents = documents.filter(d => d.matterId === filters.matterId)
    }
    if (filters?.clientId) {
      documents = documents.filter(d => d.clientId === filters.clientId)
    }
    
    return documents
  },

  async getDocument(id: string): Promise<Document> {
    await apiDelay()
    const doc = mockDocuments.find(d => d.id === id)
    if (!doc) throw new Error('Document not found')
    return doc
  },

  async uploadDocument(data: Partial<Document>): Promise<Document> {
    await apiDelay()
    const newDoc: Document = {
      id: `doc-${Date.now()}`,
      name: data.name || '',
      type: data.type || 'PDF',
      matterId: data.matterId,
      clientId: data.clientId,
      uploadedBy: data.uploadedBy || 'user-1',
      uploadedAt: new Date(),
      size: data.size || 0,
      version: 1,
      versions: [{ version: 1, uploadedAt: new Date(), uploadedBy: data.uploadedBy || 'user-1', size: data.size || 0 }],
      approvedForPortal: false,
    }
    mockDocuments.push(newDoc)
    return newDoc
  },

  async approveDocumentForPortal(id: string, approvedBy: string): Promise<Document> {
    await apiDelay()
    const index = mockDocuments.findIndex(d => d.id === id)
    if (index === -1) throw new Error('Document not found')
    mockDocuments[index].approvedForPortal = true
    mockDocuments[index].approvedBy = approvedBy
    mockDocuments[index].approvedAt = new Date()
    return mockDocuments[index]
  },
}

// Invoices API
export const invoicesApi = {
  async listInvoices(filters?: any): Promise<Invoice[]> {
    await apiDelay()
    let invoices = [...mockInvoices]
    
    if (filters?.status) {
      invoices = invoices.filter(i => i.status === filters.status)
    }
    if (filters?.clientId) {
      invoices = invoices.filter(i => i.clientId === filters.clientId)
    }
    
    return invoices
  },

  async getInvoice(id: string): Promise<Invoice> {
    await apiDelay()
    const invoice = mockInvoices.find(i => i.id === id)
    if (!invoice) throw new Error('Invoice not found')
    return invoice
  },

  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    await apiDelay()
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      number: data.number || `INV-${new Date().getFullYear()}-${String(mockInvoices.length + 1).padStart(3, '0')}`,
      clientId: data.clientId || '',
      matterId: data.matterId,
      status: 'DRAFT',
      issueDate: data.issueDate || new Date(),
      dueDate: data.dueDate || new Date(),
      lineItems: data.lineItems || [],
      subtotal: data.subtotal || 0,
      tax: data.tax || 0,
      total: data.total || 0,
      paidAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockInvoices.push(newInvoice)
    return newInvoice
  },

  async recordPayment(id: string, amount: number): Promise<Invoice> {
    await apiDelay()
    const index = mockInvoices.findIndex(i => i.id === id)
    if (index === -1) throw new Error('Invoice not found')
    mockInvoices[index].paidAmount += amount
    if (mockInvoices[index].paidAmount >= mockInvoices[index].total) {
      mockInvoices[index].status = 'PAID'
    }
    mockInvoices[index].updatedAt = new Date()
    return mockInvoices[index]
  },
}

// Trust API
export const trustApi = {
  async listTrustAccounts(filters?: any): Promise<TrustAccount[]> {
    await apiDelay()
    return [...mockTrustAccounts]
  },

  async getTrustAccount(id: string): Promise<TrustAccount> {
    await apiDelay()
    const account = mockTrustAccounts.find(a => a.id === id)
    if (!account) throw new Error('Trust account not found')
    return account
  },

  async createTrustTransaction(data: Partial<TrustTransaction>): Promise<TrustTransaction> {
    await apiDelay()
    const newTransaction: TrustTransaction = {
      id: `tt-${Date.now()}`,
      accountId: data.accountId || '',
      type: data.type || 'DEPOSIT',
      amount: data.amount || 0,
      description: data.description || '',
      status: 'PENDING',
      requestedBy: data.requestedBy || 'user-1',
      createdAt: new Date(),
    }
    const account = mockTrustAccounts.find(a => a.id === data.accountId)
    if (account) {
      account.transactions.push(newTransaction)
    }
    return newTransaction
  },

  async approveTrustDisbursement(id: string, approvedBy: string): Promise<TrustTransaction> {
    await apiDelay()
    for (const account of mockTrustAccounts) {
      const transaction = account.transactions.find(t => t.id === id)
      if (transaction) {
        transaction.status = 'APPROVED'
        transaction.approvedBy = approvedBy
        transaction.approvedAt = new Date()
        if (transaction.type === 'DISBURSEMENT') {
          account.balance -= transaction.amount
        }
        return transaction
      }
    }
    throw new Error('Transaction not found')
  },
}

// Notifications API
export const notificationsApi = {
  async listNotifications(userId: string): Promise<Notification[]> {
    await apiDelay()
    return mockNotifications.filter(n => n.userId === userId)
  },

  async markAsRead(id: string): Promise<Notification> {
    await apiDelay()
    const notification = mockNotifications.find(n => n.id === id)
    if (!notification) throw new Error('Notification not found')
    notification.read = true
    return notification
  },

  async markAllAsRead(userId: string): Promise<void> {
    await apiDelay()
    mockNotifications.forEach(n => {
      if (n.userId === userId) n.read = true
    })
  },
}

// Automations API
export const automationsApi = {
  async listRules(): Promise<AutomationRule[]> {
    await apiDelay()
    return [...mockAutomationRules]
  },

  async updateRule(id: string, data: Partial<AutomationRule>): Promise<AutomationRule> {
    await apiDelay()
    const index = mockAutomationRules.findIndex(r => r.id === id)
    if (index === -1) throw new Error('Rule not found')
    mockAutomationRules[index] = { ...mockAutomationRules[index], ...data }
    return mockAutomationRules[index]
  },
}

