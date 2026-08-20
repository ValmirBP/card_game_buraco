import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Espaçamento horizontal entre os jogos baixados, em paisagem.
 *
 * HISTÓRICO: antes a fileira era `overflow-hidden` e as colunas se
 * sobrepunham cada vez mais pra caber TUDO sem rolagem. Com 10 jogos
 * sobravam só 28px de cada coluna de 48px — "vira uma zona", e não dava pra
 * rolar pro lado pra ver o resto (relato do usuário).
 *
 * Agora a sobreposição tem PISO: ela para em -space-x-3, que deixa 40px de
 * cada coluna à mostra (rank + naipe + boa parte da carta). Passando disso,
 * a fileira ROLA na horizontal em vez de espremer mais.
 *
 * Os degraus são calibrados pro painel real de 383px (coluna de 52px com o
 * padding) pra que a rolagem só comece no 9º jogo - e, uma vez começada, as
 * colunas NÃO encolham mais:
 *   ate 4 jogos -> folga de 6px  (52 + 4x58 = 284px)
 *   5 a 6       -> encostadas    (52 + 6x52 = 364px)
 *   7 a 8       -> -12px         (52 + 8x40 = 372px)  <- ultimo que cabe
 *   9+          -> -12px, ROLA, sempre com 40px de cada coluna à mostra
 * Antes, pra caber tudo sem rolar, 9 jogos eram espremidos até 28px e 11
 * até 20px - era o que o usuário descreveu como "vira uma zona".
 *
 * Classes literais pro Tailwind conseguir gerá-las.
 */
export function meldRowSpacing(n: number): string {
  if (n >= 7) return 'landscape:-space-x-3'
  if (n >= 5) return 'landscape:space-x-0'
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
