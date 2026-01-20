import { User, UserRole } from "@/lib/types/roles"

export const mockUsers: User[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah@lawfirm.com",
    role: "PARTNER_ADMIN",
    teamId: "team-1",
    teamName: "Corporate Law",
    avatar: "/avatars/sarah.jpg",
    lastActivity: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael@lawfirm.com",
    role: "JUNIOR_PARTNER",
    teamId: "team-1",
    teamName: "Corporate Law",
    avatar: "/avatars/michael.jpg",
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily@lawfirm.com",
    role: "ASSOCIATE",
    teamId: "team-1",
    teamName: "Corporate Law",
    avatar: "/avatars/emily.jpg",
    lastActivity: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: "4",
    name: "David Kim",
    email: "david@lawfirm.com",
    role: "ASSOCIATE",
    teamId: "team-2",
    teamName: "Litigation",
    avatar: "/avatars/david.jpg",
    lastActivity: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: "5",
    name: "Lisa Wang",
    email: "lisa@lawfirm.com",
    role: "PARALEGAL",
    teamId: "team-1",
    teamName: "Corporate Law",
    avatar: "/avatars/lisa.jpg",
    lastActivity: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "6",
    name: "James Thompson",
    email: "james@lawfirm.com",
    role: "FINANCE",
    teamId: undefined,
    teamName: undefined,
    avatar: "/avatars/james.jpg",
    lastActivity: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: "7",
    name: "Maria Garcia",
    email: "maria@lawfirm.com",
    role: "INTAKE",
    teamId: undefined,
    teamName: undefined,
    avatar: "/avatars/maria.jpg",
    lastActivity: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    id: "8",
    name: "Robert Brown",
    email: "robert@lawfirm.com",
    role: "OPS_HR",
    teamId: undefined,
    teamName: undefined,
    avatar: "/avatars/robert.jpg",
    lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: "9",
    name: "Jennifer Lee",
    email: "jennifer@lawfirm.com",
    role: "RECEPTION",
    teamId: undefined,
    teamName: undefined,
    avatar: "/avatars/jennifer.jpg",
    lastActivity: new Date(Date.now() - 3 * 60 * 1000),
  },
]

export function getUserById(id: string): User | undefined {
  return mockUsers.find((u) => u.id === id)
}

export function getUsersByTeam(teamId: string): User[] {
  return mockUsers.filter((u) => u.teamId === teamId)
}

export function getUsersByRole(role: UserRole): User[] {
  return mockUsers.filter((u) => u.role === role)
}

