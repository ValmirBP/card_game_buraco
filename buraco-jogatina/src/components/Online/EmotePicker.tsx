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
    <div className="relative">
      <button
        type="button"
        aria-label="Reações"
        aria-expanded={open}
        disabled={coolingDown}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs leading-none shadow-sm transition disabled:opacity-40 landscape:px-1 landscape:py-px landscape:text-[10px] ${
          open
            ? 'border-card-gold bg-card-gold/25 text-card-gold'
            : 'border-card-gold/50 bg-black/30 text-card-gold/90 hover:bg-card-gold/15'
        }`}
      >
        <span aria-hidden="true">💬</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Escolha uma reação"
          className="absolute bottom-full left-0 z-[140] mb-1.5 flex gap-0.5 rounded-2xl border border-card-gold/40 bg-black/85 px-1.5 py-1 shadow-[0_-6px_24px_rgba(0,0,0,0.5)] backdrop-blur-md"
        >
          {EMOTES.map(emoji => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              aria-label={emoji}
              onClick={() => pick(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:scale-125 hover:bg-white/10 landscape:h-8 landscape:w-8 landscape:text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
