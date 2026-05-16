import { Text } from 'react-native'
import type { AppIconName } from '../types'

export function AppIcon({ color, name, size = 16 }: { color: string; name: AppIconName; size?: number }) {
  const glyph =
    name === 'menu'     ? '≡' :
    name === 'cart'     ? '◫' :
    name === 'home'     ? '⌂' :
    name === 'tickets'  ? '▤' :
    name === 'scan'     ? '◈' :
    name === 'account'  ? '◉' :
    name === 'brand'    ? '✦' :
    name === 'login'    ? '↪' :
    name === 'logout'   ? '↩' :
    name === 'close'    ? '×' :
    name === 'search'   ? '⌕' :
    name === 'check'    ? '✓' :
    name === 'calendar' ? '◻' :
    name === 'gallery'  ? '⬚' :
    name === 'back'     ? '‹' :
    '×'

  return <Text style={{ color, fontSize: size, fontWeight: '800', lineHeight: size + 2 }}>{glyph}</Text>
}
