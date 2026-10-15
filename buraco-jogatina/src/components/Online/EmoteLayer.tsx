import { AnimatePresence, motion } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'

function anchorRect(seat: number, mySeat: number): DOMRect | undefined {
  if (seat === mySeat) return document.getElementById('player-hand-anchor')?.getBoundingClientRect()
  return Array.from(document.querySelectorAll(`[data-seat-index="${seat}"]`))
    .map(el => el.getBoundingClientRect())
    .find(r => r.width > 0 || r.height > 0)
}

export default function EmoteLayer({ mySeat }: { mySeat: number }) {
  const emotes = useOnlineStore(s => s.emotes)
  return (
    <div className="pointer-events-none fixed inset-0 z-[125]" aria-live="polite">
      <AnimatePresence>
        {emotes.map(e => {
          const rect = anchorRect(e.seat, mySeat)
          const left = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
          const top = rect ? rect.top : window.innerHeight / 2
          return (
            <motion.div
              key={e.id}
              data-emote-seat={e.seat}
              role="img"
              aria-label={e.emoji}
              initial={{ opacity: 0, scale: 0.3, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              className="absolute -translate-x-1/2 -translate-y-full rounded-full border-2 border-white/40 bg-black/70 px-2 py-1 text-3xl leading-none shadow-[0_6px_20px_rgba(0,0,0,0.5)] landscape:text-2xl"
              style={{ left, top }}
            >
              {e.emoji}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
