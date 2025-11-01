'use client'

import { useState, createContext, useContext, ReactNode } from 'react'

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function MainContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div
      className="transition-all duration-300"
      style={{
        paddingLeft: collapsed ? '80px' : '256px',
      }}
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}
