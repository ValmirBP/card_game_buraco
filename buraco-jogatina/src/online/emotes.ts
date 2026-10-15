export const EMOTES = ['👍', '👏', '😂', '😮', '😢', '😡', '🔥', '🙏', '🤝', '🍀', '😎', '🤔'] as const

export type Emote = (typeof EMOTES)[number]

export const EMOTE_COOLDOWN_MS = 1500
export const EMOTE_VISIBLE_MS = 3000

export function isEmote(value: unknown): value is Emote {
  return typeof value === 'string' && (EMOTES as readonly string[]).includes(value)
}
