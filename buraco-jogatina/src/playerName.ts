const PLAYER_NAME_STORAGE_KEY = 'buraco-player-name'

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
