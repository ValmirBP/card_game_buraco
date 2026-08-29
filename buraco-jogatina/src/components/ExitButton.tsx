interface ExitButtonProps {
  onClick: () => void
}

/**
 * Botão de saída visível DURANTE uma partida em andamento — offline e
 * online. Antes disso, o único jeito de sair no meio do jogo era o botão
 * voltar do Android, que nem sequer era tratado (o padrão do WebView é
 * minimizar o app inteiro). Agora os dois caminhos levam ao MESMO lugar: o
 * voltar por hardware do Android (ver o listener central em App.tsx) e este
 * botão disparam a mesma confirmação, então o comportamento é idêntico não
 * importa como o jogador tenta sair.
 *
 * Um único componente compartilhado entre Gameplay.tsx (offline) e
 * OnlineGameplay.tsx (online) garante que os dois modos fiquem visualmente
 * e funcionalmente iguais nesse ponto — pedido do usuário.
 */
export default function ExitButton({ onClick }: ExitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Sair da partida"
      className="shrink-0 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-gray-300 backdrop-blur-sm transition-colors hover:border-red-400/50 hover:text-red-300 landscape:px-1.5 landscape:py-0.5 landscape:text-[10px]"
    >
      ✕ <span className="hidden sm:inline">Sair</span>
    </button>
  )
}
