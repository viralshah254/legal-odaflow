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
    const savedUser = localStorage.getItem("dev-current-user")
    
    if (savedRole && Object.values(["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "FINANCE", "INTAKE", "OPS_HR", "RECEPTION", "READ_ONLY"]).includes(savedRole)) {
      setCurrentRole(savedRole)
    }
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        setCurrentUser(user)
      } catch (e) {
        // Invalid JSON
      }
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

