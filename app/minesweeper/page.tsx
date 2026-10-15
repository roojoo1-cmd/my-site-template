"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  DIFFICULTIES,
  chord,
  createGame,
  flagsLeft,
  reveal,
  toggleFlag,
  type Difficulty,
  type Game,
} from "@/lib/minesweeper"

const NUMBER_COLORS = [
  "",
  "text-blue-600",
  "text-green-700",
  "text-red-600",
  "text-indigo-900",
  "text-red-900",
  "text-teal-600",
  "text-black",
  "text-gray-500",
]

const LONG_PRESS_MS = 400

function newGame(d: Difficulty) {
  const { rows, cols, mines } = DIFFICULTIES[d]
  return createGame(rows, cols, mines)
}

function pad(n: number) {
  const v = Math.max(-99, Math.min(999, n))
  return (v < 0 ? "-" + String(-v).padStart(2, "0") : String(v).padStart(3, "0"))
}

export default function MinesweeperPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner")
  const [game, setGame] = useState<Game>(() => newGame("beginner"))
  const [seconds, setSeconds] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const [pressing, setPressing] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  const restart = useCallback((d: Difficulty) => {
    setDifficulty(d)
    setGame(newGame(d))
    setSeconds(0)
  }, [])

  // 첫 클릭으로 status가 playing이 되면 타이머 시작, 끝나면 정지
  useEffect(() => {
    if (game.status !== "playing") return
    const id = setInterval(() => setSeconds((s) => Math.min(999, s + 1)), 1000)
    return () => clearInterval(id)
  }, [game.status])

  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }

  const activate = (r: number, c: number) => {
    const cell = game.board[r][c]
    if (cell.revealed) setGame(chord(game, r, c))
    else if (flagMode) setGame(toggleFlag(game, r, c))
    else setGame(reveal(game, r, c))
  }

  const face = game.status === "won" ? "😎" : game.status === "lost" ? "😵" : pressing ? "😮" : "🙂"

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-fit">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold">지뢰찾기</h1>
          <Link href="/" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
            홈으로
          </Link>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => restart(d)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                d === difficulty ? "bg-foreground text-background" : "hover:bg-accent"
              )}
            >
              {DIFFICULTIES[d].label} ({DIFFICULTIES[d].cols}×{DIFFICULTIES[d].rows}, {DIFFICULTIES[d].mines})
            </button>
          ))}
        </div>

        <div className="inline-block select-none rounded-sm border-4 border-t-white border-l-white border-b-gray-500 border-r-gray-500 bg-[#c0c0c0] p-2 text-black">
          <div className="mb-2 flex items-center justify-between border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white p-1.5">
            <span className="min-w-[3.2rem] bg-black px-1 text-right font-mono text-2xl leading-none text-red-600 py-0.5">
              {pad(flagsLeft(game))}
            </span>
            <button
              onClick={() => restart(difficulty)}
              aria-label="새 게임"
              className="h-9 w-9 border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-xl leading-none active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
            >
              {face}
            </button>
            <span className="min-w-[3.2rem] bg-black px-1 text-right font-mono text-2xl leading-none text-red-600 py-0.5">
              {pad(seconds)}
            </span>
          </div>

          <div
            className="grid border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white"
            style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={() => setPressing(false)}
          >
            {game.board.map((row, r) =>
              row.map((cell, c) => {
                const isExploded = game.exploded?.[0] === r && game.exploded?.[1] === c
                const wrongFlag = game.status === "lost" && cell.flagged && !cell.mine
                let content: React.ReactNode = null
                if (wrongFlag) content = "❌"
                else if (cell.flagged) content = "🚩"
                else if (cell.revealed && cell.mine) content = "💣"
                else if (cell.revealed && cell.adjacent > 0) content = cell.adjacent

                return (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`${r + 1}행 ${c + 1}열`}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center text-sm font-bold leading-none sm:h-7 sm:w-7",
                      cell.revealed
                        ? "border border-gray-400 bg-[#c0c0c0]"
                        : "border-[3px] border-t-white border-l-white border-b-gray-500 border-r-gray-500 bg-[#c0c0c0]",
                      isExploded && "bg-red-500",
                      cell.revealed && !cell.mine && NUMBER_COLORS[cell.adjacent]
                    )}
                    onMouseDown={(e) => {
                      if (e.button === 0 || e.button === 1) setPressing(true)
                      if (e.button === 1) e.preventDefault()
                    }}
                    onMouseUp={() => setPressing(false)}
                    onClick={() => {
                      if (longPressed.current) {
                        longPressed.current = false
                        return
                      }
                      activate(r, c)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setGame((g) => toggleFlag(g, r, c))
                    }}
                    onAuxClick={(e) => {
                      // 휠 클릭 = 코드
                      if (e.button === 1) setGame((g) => chord(g, r, c))
                    }}
                    onTouchStart={() => {
                      longPressed.current = false
                      clearLongPress()
                      longPressTimer.current = setTimeout(() => {
                        longPressed.current = true
                        setGame((g) => toggleFlag(g, r, c))
                      }, LONG_PRESS_MS)
                    }}
                    onTouchEnd={clearLongPress}
                    onTouchMove={clearLongPress}
                  >
                    {content}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            onClick={() => setFlagMode((v) => !v)}
            className={cn("rounded-md border px-3 py-1.5", flagMode ? "bg-foreground text-background" : "hover:bg-accent")}
          >
            🚩 깃발 모드 {flagMode ? "켜짐" : "꺼짐"}
          </button>
          <span className="text-muted-foreground" role="status">
            {game.status === "won" && `성공! ${seconds}초 걸렸어요.`}
            {game.status === "lost" && "지뢰를 밟았어요. 얼굴을 눌러 다시 시작하세요."}
          </span>
        </div>

        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li>왼쪽 클릭: 칸 열기 / 숫자 칸 클릭: 주변 깃발 수가 숫자와 같으면 나머지 칸 한 번에 열기</li>
          <li>오른쪽 클릭(모바일은 길게 누르기): 깃발 꽂기 / 빼기, 휠 클릭: 숫자 칸 코드</li>
          <li>첫 클릭은 항상 안전하고, 클릭한 칸 주변은 빈 칸으로 열립니다.</li>
        </ul>
      </div>
    </main>
  )
}
