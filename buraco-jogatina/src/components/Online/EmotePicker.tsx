import { useEffect, useState } from 'react'
import { EMOTES, EMOTE_COOLDOWN_MS, type Emote } from '../../online/emotes'
import { useOnlineStore } from '../../online/onlineStore'

export default function EmotePicker() {
  const sendEmote = useOnlineStore(s => s.sendEmote)
  const [open, setOpen] = useState(false)
  const [coolingDown, setCoolingDown] = useState(false)

  useEffect(() => {
    if (!coolingDown) return
    const id = window.setTimeout(() => setCoolingDown(false), EMOTE_COOLDOWN_MS)
    return () => window.clearTimeout(id)
  }, [coolingDown])

  const pick = (emoji: Emote) => {
    if (coolingDown) return
    sendEmote(emoji)
    setOpen(false)
    setCoolingDown(true)
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Reações"
        aria-expanded={open}
        disabled={coolingDown}
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-lg shadow transition hover:bg-black/60 disabled:opacity-40 landscape:h-7 landscape:w-7 landscape:text-base"
      >
        😊
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Escolha uma reação"
          className="absolute left-0 top-full z-[140] mt-1 grid grid-cols-6 gap-1 rounded-xl border border-white/15 bg-black/85 p-1.5 shadow-2xl backdrop-blur-md"
        >
          {EMOTES.map(emoji => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              aria-label={emoji}
              onClick={() => pick(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-white/10 landscape:h-8 landscape:w-8 landscape:text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
