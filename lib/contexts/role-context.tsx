"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { UserRole, User, getRolePermissions } from "@/lib/types/roles"

interface RoleContextType {
  currentRole: UserRole
  currentUser: User | null
  setCurrentRole: (role: UserRole) => void
  setCurrentUser: (user: User | null) => void
  permissions: ReturnType<typeof getRolePermissions>
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>("PARTNER_ADMIN")
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    // Load from localStorage if available (for dev role switcher)
    const savedRole = localStorage.getItem("dev-current-role") as UserRole
    if (savedRole && Object.values(["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "FINANCE", "INTAKE", "OPS_HR", "RECEPTION", "READ_ONLY"]).includes(savedRole)) {
      setCurrentRole(savedRole)
    }
  }, [])

  const permissions = getRolePermissions(currentRole)

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        currentUser,
        setCurrentRole,
        setCurrentUser,
        permissions,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}

