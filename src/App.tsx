import { useState } from 'react'
import { Layout } from './components/Layout'
import Menu from './components/Menu/Menu'
import Gameplay from './components/Gameplay/Gameplay'
import Result from './components/Result/Result'
import { useGameStore } from './store/gameStore'
import type { AIDifficulty } from './engine/ai'

type Screen = 'menu' | 'gameplay' | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  // Remembered so "Jogar Novamente" from the Result screen can restart with
  // the same settings without having to dig them out of the (reset) game
  // instance. Menu.onStart reports what the player picked before starting.
  const [lastDifficulty, setLastDifficulty] = useState<AIDifficulty>('medium')
  const [lastPlayerName, setLastPlayerName] = useState('Você')

  const game = useGameStore(s => s.game)
  // `version` selected alongside `game` per the store's reactivity contract:
  // `game` keeps a stable reference across mutations, so App must still
  // subscribe to `version` to re-render when e.g. the game finishes.
  const version = useGameStore(s => s.version)
  void version

  const handleStart = (difficulty: AIDifficulty, playerName: string) => {
    setLastDifficulty(difficulty)
    setLastPlayerName(playerName)
    setScreen('gameplay')
  }

  const handlePlayAgain = () => {
    useGameStore.getState().initGame(lastPlayerName, lastDifficulty)
    setScreen('gameplay')
  }

  const handleBackToMenu = () => {
    useGameStore.getState().resetGame()
    setScreen('menu')
  }

  return (
    <Layout>
      {screen === 'menu' && <Menu onStart={handleStart} />}
      {screen === 'gameplay' && game && <Gameplay onGameEnd={() => setScreen('result')} />}
      {screen === 'result' && game && (
        <Result onBackToMenu={handleBackToMenu} onPlayAgain={handlePlayAgain} />
      )}
    </Layout>
  )
}
