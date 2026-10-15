export type Difficulty = "beginner" | "intermediate" | "expert"

export const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mines: number; label: string }> = {
  beginner: { rows: 9, cols: 9, mines: 10, label: "초급" },
  intermediate: { rows: 16, cols: 16, mines: 40, label: "중급" },
  expert: { rows: 16, cols: 30, mines: 99, label: "고급" },
}

export type Cell = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export type Status = "ready" | "playing" | "won" | "lost"

export type Game = {
  rows: number
  cols: number
  mines: number
  board: Cell[][]
  status: Status
  // 터진 칸 (패배 시 빨갛게 표시)
  exploded: [number, number] | null
}

export function createGame(rows: number, cols: number, mines: number): Game {
  const board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): Cell => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  )
  return { rows, cols, mines, board, status: "ready", exploded: null }
}

function cloneGame(g: Game): Game {
  return { ...g, board: g.board.map((row) => row.map((c) => ({ ...c }))) }
}

export function neighbors(g: Pick<Game, "rows" | "cols">, r: number, c: number): [number, number][] {
  const out: [number, number][] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < g.rows && nc >= 0 && nc < g.cols) out.push([nr, nc])
    }
  }
  return out
}

// 첫 클릭 칸과 그 주변 8칸에는 지뢰를 두지 않는다 (첫 클릭은 항상 빈 칸이 열리며 시작)
function placeMines(g: Game, safeR: number, safeC: number, rand: () => number) {
  const forbidden = new Set<number>([safeR * g.cols + safeC])
  const safeZone = neighbors(g, safeR, safeC)
  // 칸이 부족하면 주변 보호를 포기하고 첫 칸만 보호
  const protectNeighbors = g.rows * g.cols - 1 - safeZone.length >= g.mines
  if (protectNeighbors) safeZone.forEach(([r, c]) => forbidden.add(r * g.cols + c))

  const candidates: number[] = []
  for (let i = 0; i < g.rows * g.cols; i++) if (!forbidden.has(i)) candidates.push(i)
  // Fisher-Yates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  for (const idx of candidates.slice(0, g.mines)) {
    g.board[Math.floor(idx / g.cols)][idx % g.cols].mine = true
  }
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      g.board[r][c].adjacent = neighbors(g, r, c).filter(([nr, nc]) => g.board[nr][nc].mine).length
    }
  }
}

function checkWin(g: Game) {
  for (const row of g.board) for (const cell of row) if (!cell.mine && !cell.revealed) return
  g.status = "won"
  // 승리하면 남은 지뢰에 자동으로 깃발
  for (const row of g.board) for (const cell of row) if (cell.mine) cell.flagged = true
}

function lose(g: Game, r: number, c: number) {
  g.status = "lost"
  g.exploded = [r, c]
  for (const row of g.board) for (const cell of row) if (cell.mine && !cell.flagged) cell.revealed = true
}

// 빈 칸(인접 지뢰 0)이면 연쇄로 주변을 연다. 스택 기반이라 큰 판에서도 안전.
function flood(g: Game, r: number, c: number) {
  const stack: [number, number][] = [[r, c]]
  while (stack.length) {
    const [cr, cc] = stack.pop()!
    const cell = g.board[cr][cc]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.adjacent === 0 && !cell.mine) {
      for (const [nr, nc] of neighbors(g, cr, cc)) {
        const n = g.board[nr][nc]
        if (!n.revealed && !n.flagged) stack.push([nr, nc])
      }
    }
  }
}

export function reveal(game: Game, r: number, c: number, rand: () => number = Math.random): Game {
  if (game.status === "won" || game.status === "lost") return game
  const cell = game.board[r][c]
  if (cell.revealed || cell.flagged) return game

  const g = cloneGame(game)
  if (g.status === "ready") {
    placeMines(g, r, c, rand)
    g.status = "playing"
  }
  if (g.board[r][c].mine) {
    g.board[r][c].revealed = true
    lose(g, r, c)
    return g
  }
  flood(g, r, c)
  checkWin(g)
  return g
}

export function toggleFlag(game: Game, r: number, c: number): Game {
  if (game.status === "won" || game.status === "lost") return game
  if (game.board[r][c].revealed) return game
  const g = cloneGame(game)
  g.board[r][c].flagged = !g.board[r][c].flagged
  return g
}

// 숫자 칸 코드(chord): 주변 깃발 수가 숫자와 같으면 나머지 칸을 한꺼번에 연다.
// 깃발을 잘못 꽂았다면 그 결과로 지뢰를 밟아 패배한다.
export function chord(game: Game, r: number, c: number): Game {
  if (game.status !== "playing") return game
  const cell = game.board[r][c]
  if (!cell.revealed || cell.adjacent === 0) return game
  const around = neighbors(game, r, c)
  const flags = around.filter(([nr, nc]) => game.board[nr][nc].flagged).length
  if (flags !== cell.adjacent) return game

  const g = cloneGame(game)
  for (const [nr, nc] of around) {
    const n = g.board[nr][nc]
    if (n.revealed || n.flagged) continue
    if (n.mine) {
      n.revealed = true
      lose(g, nr, nc)
      return g
    }
    flood(g, nr, nc)
  }
  checkWin(g)
  return g
}

export function flagsLeft(g: Game): number {
  let flags = 0
  for (const row of g.board) for (const cell of row) if (cell.flagged) flags++
  return g.mines - flags
}
