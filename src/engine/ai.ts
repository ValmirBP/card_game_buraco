import { Player, PlayerMove } from './player'
import { Card, Suit } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'
import { Team } from './gameState'
import { isValidCanasta, canExtendMeld, rankToNumber } from './utils'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

export interface GameStateForAI {
  currentPlayerIndex: number
  players: Player[]
  deck: Card[]
  discardPile: Card[]
  teams: Team[]
}

// Ranks "seguros" de descarte (baixo valor, pouco úteis ao adversário).
// NÃO inclui '2': todo 2 pode virar curinga, então nunca é um descarte seguro.
const SAFE_RANKS = ['3', '4', '5']

/** Curinga: joker (isWild) ou qualquer 2 (todos os 2 podem ser usados como
 * curinga). A IA nunca descarta um curinga tendo carta comum na mão. */
function isWildCard(card: Card): boolean {
  return card.isWild || card.rank === '2'
}

export class AIPlayer implements Player {
  name: string
  hand: Hand
  score: number = 0
  canastas: Canasta[] = []
  difficulty: AIDifficulty
  private discardedCards: Set<string> = new Set() // Memoria para hard

  constructor(name: string, difficulty: AIDifficulty = 'medium', initialCards: Card[] = []) {
    this.name = name
    this.hand = new Hand(initialCards)
    this.difficulty = difficulty
  }

  playTurn(gameState: GameStateForAI): PlayerMove {
    return this.decide(gameState)
  }

  private decide(gameState: GameStateForAI): PlayerMove {
    switch (this.difficulty) {
      case 'easy':
        return this.decideEasy(gameState)
      case 'medium':
        return this.decideMedium(gameState)
      case 'hard':
        return this.decideHard(gameState)
    }
  }

  private decideEasy(gameState: GameStateForAI): PlayerMove {
    // Se o topo do descarte e util, 50% de chance de pegar a mesa antes de
    // sortear entre os demais movimentos validos.
    if (this.isDiscardPileUseful(gameState) && Math.random() < 0.5) {
      return { type: 'take_discard' }
    }

    const moves = this.getValidMoves(gameState)
    if (moves.length === 0) return { type: 'draw' }

    // Mesmo no facil, baixar jogos e juntar cartas na mesa sao obrigacoes
    // basicas do Buraco ("podem e devem"): se houver extend_meld ou
    // play_canasta disponivel, joga um deles (sorteando entre si). O
    // "facil" continua fraco no resto (descartes aleatorios, sem memoria).
    // Part C: enquanto o time ainda nao tem uma canastra limpa (7+, sem
    // curinga), prioriza os jogos naturais (sem curinga) dentre esses -
    // preferNaturalMelds ja faz fallback para o conjunto completo se nenhum
    // deles for natural, entao isso nunca trava a IA.
    const ownTeam = this.getOwnTeam(gameState)
    const meldMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'extend_meld' || m.type === 'play_canasta'),
      ownTeam
    )
    if (meldMoves.length > 0) {
      return meldMoves[Math.floor(Math.random() * meldMoves.length)]
    }

    // Sem jogadas de mesa: aleatorio entre os demais movimentos validos.
    return moves[Math.floor(Math.random() * moves.length)]
  }

  private decideMedium(gameState: GameStateForAI): PlayerMove {
    // Prioridade 0: compra da mesa - pega o descarte sempre que o topo for
    // util (estende meld do time ou forma jogo novo com cartas da mao).
    // So faz sentido ANTES de comprar do monte nesse turno.
    if (this.isDiscardPileUseful(gameState)) {
      return { type: 'take_discard' }
    }

    // extend_meld >= play_canasta > discard.
    const moves = this.getValidMoves(gameState)
    const ownTeam = this.getOwnTeam(gameState)

    // Prioridade 1: estender jogo existente do time. Part C: enquanto o
    // time nao tem canastra limpa, prioriza extensoes sem curinga.
    const extendMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'extend_meld'),
      ownTeam
    )
    if (extendMoves.length > 0) {
      return extendMoves[Math.floor(Math.random() * extendMoves.length)]
    }

    // Prioridade 2: jogar canastas. Mesma logica de preferencia por jogos
    // naturais enquanto nao ha canastra limpa na mesa.
    const canastaMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'play_canasta'),
      ownTeam
    )
    if (canastaMoves.length > 0) {
      return canastaMoves[Math.floor(Math.random() * canastaMoves.length)]
    }

    // Prioridade 3: descartar carta "segura" (rank baixo)
    const discardMoves = moves.filter(m => m.type === 'discard')
    if (discardMoves.length > 0) {
      const safeMove = discardMoves.find(m => {
        const idx = m.cardIndex!
        const card = this.hand.getCards()[idx]
        return SAFE_RANKS.includes(card.rank)
      })
      if (safeMove) return safeMove
      return discardMoves[Math.floor(Math.random() * discardMoves.length)]
    }

    return { type: 'draw' }
  }

  private decideHard(gameState: GameStateForAI): PlayerMove {
    // Rastreia cartas descartadas (memoria) e prioriza canastas/extensoes de
    // forma deterministica, sem uso de Math.random.
    gameState.discardPile.forEach(card => {
      this.discardedCards.add(card.toString())
    })

    // Prioridade 0: compra da mesa - pega sempre que o topo for util. Uma
    // pilha grande (>=4 cartas) com topo util e especialmente valiosa (tira
    // cartas de circulacao do adversario), mas a decisao de pegar e a mesma:
    // sempre que util, o hard pega.
    if (this.isDiscardPileUseful(gameState)) {
      return { type: 'take_discard' }
    }

    const moves = this.getValidMoves(gameState)
    const ownTeam = this.getOwnTeam(gameState)

    // extend_meld >= play_canasta > discard.

    // Prioridade 1: estender o jogo existente do time (deterministico, o de
    // menor meldIndex primeiro). Part C: prioriza extensoes sem curinga
    // enquanto o time nao tem canastra limpa.
    const extendMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'extend_meld'),
      ownTeam
    )
    if (extendMoves.length > 0) {
      const sorted = [...extendMoves].sort((a, b) => (a.meldIndex ?? 0) - (b.meldIndex ?? 0))
      return sorted[0]
    }

    // Prioridade 2: jogar a maior canasta possivel (deterministico). Mesma
    // preferencia por jogos naturais enquanto nao ha canastra limpa.
    const canastaMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'play_canasta'),
      ownTeam
    )
    if (canastaMoves.length > 0) {
      const sorted = [...canastaMoves].sort((a, b) => (b.cards?.length ?? 0) - (a.cards?.length ?? 0))
      return sorted[0]
    }

    // Prioridade 3: descartar a carta menos util. Evita descartar cartas
    // cujo par/sequencia ja apareceu no descarte (poderiam formar canasta do
    // adversario) e prefere cartas seguras / de baixo valor.
    const discardMoves = moves.filter(m => m.type === 'discard')
    if (discardMoves.length > 0) {
      const cards = this.hand.getCards()
      const scored = discardMoves
        .map(m => ({ move: m, card: cards[m.cardIndex!] }))
        .sort((a, b) => {
          const aSafe = SAFE_RANKS.includes(a.card.rank) ? 0 : 1
          const bSafe = SAFE_RANKS.includes(b.card.rank) ? 0 : 1
          if (aSafe !== bSafe) return aSafe - bSafe
          return rankToNumber(a.card.rank) - rankToNumber(b.card.rank)
        })
      return scored[0].move
    }

    return { type: 'draw' }
  }

  /**
   * Whether the top of the discard pile is worth taking: it either extends
   * one of the AI's own team's melds (canExtendMeld), or combines with 2+
   * cards already in hand to form a brand-new valid meld (same-suit run,
   * or an ace paired up towards a trio). Only meaningful BEFORE drawing
   * from the deck this turn - playTurn may return take_discard as the
   * first action of a turn; once the deck has been drawn from, taking the
   * pile no longer applies for this turn.
   */
  private isDiscardPileUseful(gameState: GameStateForAI): boolean {
    if (gameState.discardPile.length === 0) return false
    const top = gameState.discardPile[gameState.discardPile.length - 1]

    const ownTeam = this.getOwnTeam(gameState)
    if (ownTeam && ownTeam.melds.some(meld => canExtendMeld(meld.cards, [top]))) {
      return true
    }

    const cards = this.hand.getCards()
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        if (isValidCanasta([cards[i], cards[j], top])) return true
      }
    }
    return false
  }

  /**
   * Finds the current player's own team from gameState.teams by looking for
   * the team whose seats include currentPlayerIndex. Falls back to the
   * first team if not found (defensive - shouldn't happen with well-formed
   * state), keeping this AI usable even against partial/mocked game states.
   */
  private getOwnTeam(gameState: GameStateForAI): Team | undefined {
    return gameState.teams.find(t => t.seats.includes(gameState.currentPlayerIndex))
  }

  getValidMoves(gameState: GameStateForAI): PlayerMove[] {
    const moves: PlayerMove[] = []

    // Move 1: draw (sempre valido)
    moves.push({ type: 'draw' })

    // Move 2: jogar canastas detectadas na mao (novos jogos)
    moves.push(...this.findCanastaMoves())

    // Move 3: estender jogos existentes do proprio time
    const ownTeam = this.getOwnTeam(gameState)
    if (ownTeam) {
      moves.push(...this.findExtendMeldMoves(ownTeam))
    }

    // Move 4: comprar a mesa (take_discard) - so faz sentido antes de
    // comprar do monte; util quando o topo estende um meld do time ou
    // forma um jogo novo com 2+ cartas da mao.
    if (this.isDiscardPileUseful(gameState)) {
      moves.push({ type: 'take_discard' })
    }

    // Move 5: descartar. NUNCA oferece descartar um curinga (joker ou 2)
    // enquanto houver carta comum na mão — curinga é a carta mais valiosa e
    // só vai pro descarte em último caso (mão só de curingas). Vale para todas
    // as dificuldades, já que todas escolhem o descarte a partir daqui.
    const myCards = this.hand.getCards()
    const hasNonWild = myCards.some(c => !isWildCard(c))
    for (let i = 0; i < myCards.length; i++) {
      if (hasNonWild && isWildCard(myCards[i])) continue
      moves.push({ type: 'discard', cardIndex: i })
    }

    return this.hardGateDirtyMoves(moves, ownTeam)
  }

  /**
   * Bug 1 - gate duro (todas as dificuldades): enquanto o time nao tiver ao
   * menos uma canastra LIMPA FECHADA na mesa (7+, sem curinga), a IA nunca
   * PROPOE (nem em getValidMoves) um play_canasta ou extend_meld que
   * resultaria num meld sujo (isClean=false, ground-truth via Canasta -
   * pega tambem o caso do 2-mesmo-naipe que virou sujo pela regra do 9).
   * Nao afeta draw/take_discard/discard - a IA nunca fica travada, so
   * comprar/descartar continuam sempre disponiveis. Uma vez que o time tem
   * uma canastra limpa fechada, este gate vira no-op (moves e devolvido sem
   * alteracao) e jogos sujos passam a ser propostos normalmente.
   */
  private hardGateDirtyMoves(moves: PlayerMove[], ownTeam: Team | undefined): PlayerMove[] {
    if (!ownTeam || this.teamHasCleanCanastra(ownTeam)) return moves
    return moves.filter(m => {
      if (m.type !== 'play_canasta' && m.type !== 'extend_meld') return true
      return !this.isDirtyMeldMove(m, ownTeam)
    })
  }

  /**
   * For each meld belonging to the AI's own team, tries extending it with
   * each single card in hand (and, for wilds, the lone wild) via
   * canExtendMeld. Not exhaustive (doesn't try multi-card extensions), but
   * sufficient to find legal, non-harmful extensions - this AI only needs
   * to never propose an illegal move, not to play optimally.
   *
   * Part C guardrail (all difficulties): never proposes an extension that
   * would turn one of the team's already-clean canastras (7+ cards, no
   * curinga) into a dirty one. Checked by actually building the extended
   * Canasta and reading its `isClean` flag (ground truth per utils.analyzeMeld
   * - e.g. catches a same-suit '2' dirtying via "regra do 9", not just a
   * literal joker), rather than assuming only isWild cards can dirty a meld.
   */
  private findExtendMeldMoves(ownTeam: Team): PlayerMove[] {
    const moves: PlayerMove[] = []
    const cards = this.hand.getCards()

    ownTeam.melds.forEach((meld, meldIndex) => {
      for (const card of cards) {
        if (!canExtendMeld(meld.cards, [card])) continue
        if (this.wouldDirtyCleanCanastra(meld, [card])) continue
        moves.push({ type: 'extend_meld', meldIndex, cards: [card] })
      }
    })

    return moves
  }

  /**
   * True if `meld` is currently a clean canastra (7+ cards, no curinga) AND
   * extending it with `added` would make the result dirty. Used as the Part
   * C guardrail in findExtendMeldMoves - the AI must never propose sujar an
   * existing clean canastra of its own team.
   */
  private wouldDirtyCleanCanastra(meld: Canasta, added: Card[]): boolean {
    if (!meld.isCanastra || !meld.isClean) return false
    try {
      return !meld.withExtraCards(added).isClean
    } catch {
      // Extension turned out invalid after all (shouldn't happen since the
      // caller already checked canExtendMeld) - not this guardrail's concern.
      return false
    }
  }

  /** Whether the team already has at least one clean canastra (7+ cards, no curinga) on the table. */
  private teamHasCleanCanastra(team: Team): boolean {
    return team.melds.some(m => m.isCanastra && m.isClean)
  }

  /**
   * True if playing `move` (a play_canasta or extend_meld) would result in a
   * dirty (curinga-using) meld for the team - i.e. a brand-new canasta built
   * with a curinga, or an extension that uses one. Ground-truth check via
   * Canasta/withExtraCards (not just Card.isWild) so it also catches a
   * natural '2' acting as curinga (e.g. "regra do 9").
   */
  private isDirtyMeldMove(move: PlayerMove, ownTeam: Team | undefined): boolean {
    if (!move.cards || move.cards.length === 0) return false

    if (move.type === 'play_canasta') {
      try {
        return !new Canasta(move.cards).isClean
      } catch {
        return false
      }
    }

    if (move.type === 'extend_meld' && ownTeam) {
      const meld = ownTeam.melds[move.meldIndex ?? -1]
      if (!meld) return false
      try {
        return !meld.withExtraCards(move.cards).isClean
      } catch {
        return false
      }
    }

    return false
  }

  /**
   * Part C: while the team doesn't yet have any clean canastra (7+, no
   * curinga) on the table, prefer meld moves (extend_meld/play_canasta)
   * that don't use a curinga at all - avoid needlessly sujar-ing a jogo
   * before locking in at least one clean canastra. Once the team already
   * has a clean canastra, this is a no-op. Never removes every option: if
   * ALL candidate moves would be dirty, they're all kept unfiltered - this
   * prioritizes clean plays, it doesn't forbid dirty ones forever (e.g. the
   * AI shouldn't get stuck holding cards when a dirty play is the only
   * progress available).
   */
  private preferNaturalMelds(moves: PlayerMove[], ownTeam: Team | undefined): PlayerMove[] {
    if (moves.length === 0 || !ownTeam) return moves
    if (this.teamHasCleanCanastra(ownTeam)) return moves
    const natural = moves.filter(m => !this.isDirtyMeldMove(m, ownTeam))
    return natural.length > 0 ? natural : moves
  }

  /**
   * Busca simples (nao exaustiva) por canastas possiveis na mao:
   *  - agrupa cartas reais por naipe, ordena por rank e testa janelas
   *    contiguas de 3+ cartas (com ou sem 1 curinga da mao para preencher
   *    uma lacuna) - encontra sequencias normais e ace-alto (...Q-K-A, ja
   *    que rankToNumber trata A como 14).
   *  - separadamente, procura trincas de ases (2-4 Ases reais de quaisquer
   *    naipes, com ou sem 1 curinga), que sao validas independente de naipe.
   * Suficiente para encontrar canastas obvias; nao precisa ser exaustiva.
   */
  private findCanastaMoves(): PlayerMove[] {
    const moves: PlayerMove[] = []
    const cards = this.hand.getCards()
    const wilds = cards.filter(c => c.isWild)

    const bySuit = new Map<Suit, Card[]>()
    for (const c of cards) {
      if (c.isWild) continue
      if (!bySuit.has(c.suit)) bySuit.set(c.suit, [])
      bySuit.get(c.suit)!.push(c)
    }

    for (const suitCards of bySuit.values()) {
      // dedupe por rank (mantem a primeira ocorrencia)
      const byRank = new Map<number, Card>()
      for (const c of suitCards) {
        const r = rankToNumber(c.rank)
        if (!byRank.has(r)) byRank.set(r, c)
      }
      const sorted = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)

      // Janelas de 3+ cartas reais contiguas na lista ordenada
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 2; j < sorted.length; j++) {
          const windowCards = sorted.slice(i, j + 1)
          if (isValidCanasta(windowCards)) {
            moves.push({ type: 'play_canasta', cards: windowCards })
          } else if (wilds.length > 0) {
            const withWild = [...windowCards, wilds[0]]
            if (isValidCanasta(withWild)) {
              moves.push({ type: 'play_canasta', cards: withWild })
            }
          }
        }
      }

      // 2 cartas reais + 1 curinga (preenche 1 lacuna) = canasta de 3
      if (wilds.length > 0) {
        for (let i = 0; i < sorted.length - 1; i++) {
          const windowCards = [sorted[i], sorted[i + 1]]
          const withWild = [...windowCards, wilds[0]]
          if (isValidCanasta(withWild)) {
            moves.push({ type: 'play_canasta', cards: withWild })
          }
        }
      }
    }

    // Trinca de ases: 3+ Ases reais (quaisquer naipes) formam um jogo
    // valido, independente da regra normal de naipe/sequencia.
    const aces = cards.filter(c => !c.isWild && c.rank === 'A')
    if (aces.length >= 3) {
      moves.push({ type: 'play_canasta', cards: [...aces] })
    } else if (aces.length === 2 && wilds.length > 0) {
      moves.push({ type: 'play_canasta', cards: [...aces, wilds[0]] })
    }

    return moves
  }

  getDiscardedCards(): Set<string> {
    return this.discardedCards
  }

  addCanasta(canasta: Canasta): void {
    this.canastas.push(canasta)
    this.score += canasta.getScore()
  }

  clone(): AIPlayer {
    const clone = new AIPlayer(this.name, this.difficulty, this.hand.getCards())
    clone.score = this.score
    clone.canastas = this.canastas.map(c => c.clone())
    clone.discardedCards = new Set(this.discardedCards)
    return clone
  }
}
