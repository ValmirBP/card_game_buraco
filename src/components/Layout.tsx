import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  /** When true, the whole screen is locked to the viewport height with no
   * page scroll (used by the gameplay screen so the table, hand and actions
   * all fit at once). When false (default), the content flows and the page
   * scrolls normally (menu, result). */
  fit?: boolean
}

/** Subtle woven-fabric noise for the felt, as an inline SVG data URI (no
 * external assets — keeps the app fully offline/PWA-friendly). A sparse
 * field of tiny semi-transparent dots gives the felt a bit of tooth without
 * reading as "noisy" or busy. */
const FELT_NOISE_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

export function Layout({ children, fit = false }: LayoutProps) {
  return (
    <div
      className={`relative w-full overflow-x-hidden text-white ${
        fit ? 'h-[100dvh] overflow-y-hidden' : 'min-h-screen'
      }`}
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
       * area, warm brown gradient with a subtle inner bevel — CSS only.
       *
       * Safe-area-inset (A6): o Android desenha atrás do recorte de câmera
       * (LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES no MainActivity +
       * viewport-fit=cover no index.html), e em paisagem o recorte cai numa
       * das bordas LATERAIS (esquerda ou direita, dependendo da rotação).
       * Sem isso, conteúdo perto da borda (ex.: o selo de turno/morto no
       * canto) podia ficar atrás do recorte. `max(0.125rem, env(...))`
       * preserva o padding visual de sempre (0.125rem = p-0.5) em telas sem
       * recorte, onde env() resolve pra 0. A altura também desconta os
       * insets de cima/baixo, não só o dvh cru. */}
      <div
        className={`relative z-10 mx-auto max-w-7xl rounded-[2rem] p-1.5 sm:p-2.5 ${
          fit
            ? 'my-1.5 flex h-[calc(100dvh-0.75rem)] flex-col sm:my-2 sm:h-[calc(100dvh-1rem)] landscape:my-0 landscape:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] landscape:max-w-none landscape:rounded-none landscape:p-0.5 landscape:pl-[max(0.125rem,env(safe-area-inset-left))] landscape:pr-[max(0.125rem,env(safe-area-inset-right))]'
            : 'my-4 sm:my-6'
        }`}
        style={{
          background: 'linear-gradient(160deg, #8a5a2e 0%, #6b4423 45%, #4a2f18 100%)',
          boxShadow:
            'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 8px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div
          className={`rounded-[1.6rem] ${
            fit
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 sm:px-3 sm:py-3 landscape:rounded-lg landscape:px-1 landscape:py-1'
              : 'px-4 py-6'
          }`}
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
