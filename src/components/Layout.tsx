import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-card-green to-green-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  )
}
