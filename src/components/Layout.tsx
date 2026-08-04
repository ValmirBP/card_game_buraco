import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-card-green text-white">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  )
}
