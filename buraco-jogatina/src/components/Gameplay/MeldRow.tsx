import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Espaçamento horizontal entre os jogos baixados, em paisagem.
 *
 * HISTÓRICO: a fileira já foi `overflow-hidden`, e as colunas se sobrepunham
 * cada vez mais pra caber TUDO sem rolagem. Depois passou a rolar, mas MANTIVE
 * uma sobreposição de 12px (-space-x-3) — e é isso que o usuário ainda via
 * como "amontoado" a partir do 9º jogo: uma coluna cobrindo a borda da outra.
 *
 * Agora NÃO há sobreposição nenhuma: um respiro fixo de 6px entre cada jogo,
 * cada carta inteira e separada. Quando os jogos passam da largura do painel,
 * a fileira simplesmente ROLA na horizontal (overflow-x-auto abaixo). Nada é
 * espremido; o que não cabe fica a um arraste de distância.
 *
 * Constante de propósito: o espaçamento não muda mais com a quantidade de
 * jogos. Recebe `n` só pra manter a assinatura estável para os chamadores.
 * Classe literal pro Tailwind conseguir gerá-la.
 */
export function meldRowSpacing(_n: number): string {
  return 'landscape:space-x-1.5'
}

interface MeldRowProps {
  /** Quantidade de jogos — define o espaçamento e redispara a medição. */
  count: number
  children: ReactNode
}

/**
 * A fileira de jogos baixados de uma dupla. Em paisagem rola na horizontal
 * quando a mesa enche, com um esmaecido na borda direita indicando que há
 * mais jogos além da dobra (sem isso a rolagem passa despercebida: a barra
 * do WebView só aparece durante o gesto).
 */
export default function MeldRow({ count, children }: MeldRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasMoreRight, setHasMoreRight] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    // 1px de folga: larguras fracionárias marcariam overflow eterno.
    const overflows = el.scrollWidth > el.clientWidth + 1
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setHasMoreRight(overflows && !atEnd)
  }, [])

  useLayoutEffect(measure, [measure, count])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', measure, { passive: true })
    // Rotacionar o aparelho muda a largura do painel; sem observar, o
    // esmaecido ficaria preso no estado da orientação anterior.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro?.disconnect()
    }
  }, [measure])

  return (
    <div className="relative landscape:min-h-0 landscape:flex-1">
      <div
        ref={ref}
        className={`flex flex-wrap items-start gap-3 landscape:h-full landscape:flex-nowrap landscape:gap-0 landscape:overflow-x-auto landscape:overflow-y-hidden landscape:overscroll-x-contain no-scrollbar ${meldRowSpacing(
          count
        )}`}
      >
        {children}
      </div>
      {hasMoreRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-6 bg-gradient-to-l from-black/70 to-transparent landscape:block" />
      )}
    </div>
  )
}
