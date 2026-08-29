const PLAYER_NAME_STORAGE_KEY = 'buraco-player-name'

/**
 * Nome do jogador, compartilhado entre a tela inicial (Menu.tsx) e a tela
 * online (OnlineLobby.tsx) via localStorage — mesmo padrão já usado pelo
 * endereço do servidor em onlineStore.ts. Editar num lugar reflete no
 * outro, sem precisar digitar de novo (pedido do usuário).
 */
export function loadStoredPlayerName(): string {
  try {
    return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || 'Você'
  } catch {
    return 'Você'
  }
}

export function savePlayerName(name: string): void {
  try {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name)
  } catch {
    // localStorage indisponível (ex.: modo privado) - só não persiste
    // entre telas/sessões, sem quebrar o app.
  }
}
