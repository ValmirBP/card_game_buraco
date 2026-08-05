import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

/** Subtle woven-fabric noise for the felt, as an inline SVG data URI (no
 * external assets — keeps the app fully offline/PWA-friendly). A sparse
 * field of tiny semi-transparent dots gives the felt a bit of tooth without
 * reading as "noisy" or busy. */
const FELT_NOISE_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

export function Layout({ children }: LayoutProps) {
  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden text-white"
      style={{
        backgroundColor: '#0f5132',
        backgroundImage: [
          // Soft vignette for depth, as if lit from above-center.
          'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,255,255,0.05), transparent 60%)',
          'radial-gradient(ellipse 120% 90% at 50% 100%, rgba(0,0,0,0.35), transparent 65%)',
          // Faint repeating conic sheen to suggest woven fabric direction.
          'repeating-conic-gradient(from 45deg, rgba(255,255,255,0.015) 0deg 2deg, transparent 2deg 8deg)',
          `url("${FELT_NOISE_SVG}")`,
        ].join(', '),
        backgroundBlendMode: 'normal, normal, overlay, overlay',
      }}
    >
      {/* Wooden table frame: a rounded border "moldura" around the play
       * area, warm brown gradient with a subtle inner bevel — CSS only. */}
      <div
        className="relative z-10 mx-auto my-4 max-w-7xl rounded-[2rem] p-1.5 sm:my-6 sm:p-2.5"
        style={{
          background: 'linear-gradient(160deg, #8a5a2e 0%, #6b4423 45%, #4a2f18 100%)',
          boxShadow:
            'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 8px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div
          className="rounded-[1.6rem] px-4 py-6"
          style={{
            backgroundColor: '#0f5132',
            backgroundImage: [
              'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,255,255,0.05), transparent 60%)',
              'radial-gradient(ellipse 120% 90% at 50% 100%, rgba(0,0,0,0.3), transparent 65%)',
              'repeating-conic-gradient(from 45deg, rgba(255,255,255,0.015) 0deg 2deg, transparent 2deg 8deg)',
              `url("${FELT_NOISE_SVG}")`,
            ].join(', '),
            backgroundBlendMode: 'normal, normal, overlay, overlay',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.4)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
