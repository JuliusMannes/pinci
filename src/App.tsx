import { useEffect } from 'react'
import { useNav } from './store/nav.ts'
import { useSettings } from './store/settings.ts'
import { TabBar } from './ui/components/TabBar.tsx'
import { HomeScreen } from './ui/screens/Home.tsx'
import { GameScreen } from './ui/screens/Game.tsx'
import { SummaryScreen } from './ui/screens/Summary.tsx'
import { DecksScreen } from './ui/screens/Decks.tsx'
import { DeckDetailScreen } from './ui/screens/DeckDetail.tsx'
import { ImportScreen } from './ui/screens/Import.tsx'
import { StatsScreen } from './ui/screens/Stats.tsx'
import { SettingsScreen } from './ui/screens/Settings.tsx'

function useTheme() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export function App() {
  useTheme()
  const route = useNav((s) => s.route)
  const fullscreen = route.name === 'game' || route.name === 'summary'
  return (
    <>
      {route.name === 'home' && <HomeScreen />}
      {route.name === 'game' && <GameScreen setup={route.setup} nonce={route.nonce} />}
      {route.name === 'summary' && <SummaryScreen setup={route.setup} result={route.result} best={route.best} />}
      {route.name === 'decks' && <DecksScreen />}
      {route.name === 'deck' && <DeckDetailScreen id={route.id} />}
      {route.name === 'import' && <ImportScreen />}
      {route.name === 'stats' && <StatsScreen />}
      {route.name === 'settings' && <SettingsScreen />}
      {!fullscreen && <TabBar />}
    </>
  )
}
