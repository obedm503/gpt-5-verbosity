import * as fs from "node:fs"
import * as path from "node:path"

/**
 * Shared state helpers used by both the server plugin (src/server.ts) and the
 * TUI plugin (src/tui.tsx). The two run in different processes, so the state
 * is persisted as a small JSON file under `<opencode state>/gpt-5-verbosity/`
 * (both sides learn the state directory from the OpenCode server: TUI via
 * `api.state.path.state`, server plugin via `client.path.get()`).
 */

export const LEVELS = ["unset", "low", "medium", "high"] as const
export type Level = (typeof LEVELS)[number]

export type VerbosityState = {
  /** Last set level. Used as the default for sessions without an explicit level. */
  default: Level
  /** Explicit per-session levels, keyed by session ID. */
  sessions: Record<string, Level>
}

/** Subdirectory of the OpenCode state directory holding this plugin's files. */
export const PLUGIN_STATE_DIR = "gpt-5-verbosity"

export const STATE_FILE = "state.json"

/** Keep the sessions map from growing forever. */
const MAX_SESSIONS = 500

export function pluginStateDir(stateDir: string) {
  return path.join(stateDir, PLUGIN_STATE_DIR)
}

export function stateFilePath(stateDir: string) {
  return path.join(pluginStateDir(stateDir), STATE_FILE)
}

function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
}

export function readState(stateDir: string): VerbosityState {
  const empty: VerbosityState = { default: "unset", sessions: {} }
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(stateFilePath(stateDir), "utf8"))
    if (!raw || typeof raw !== "object") {
      return empty
    }
    const record = raw as Record<string, unknown>
    const sessions: Record<string, Level> = {}
    if (record.sessions && typeof record.sessions === "object") {
      for (const [key, value] of Object.entries(record.sessions)) {
        if (isLevel(value)) {
          sessions[key] = value
        }
      }
    }
    return {
      default: isLevel(record.default) ? record.default : "unset",
      sessions,
    }
  } catch {
    return empty
  }
}

export function writeState(stateDir: string, state: VerbosityState) {
  const keys = Object.keys(state.sessions)
  if (keys.length > MAX_SESSIONS) {
    // JSON objects preserve insertion order, so the first keys are the oldest.
    for (const key of keys.slice(0, keys.length - MAX_SESSIONS)) {
      delete state.sessions[key]
    }
  }
  fs.mkdirSync(pluginStateDir(stateDir), { recursive: true })
  const file = stateFilePath(stateDir)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, file)
}

/** Level for a session: its explicit level, or the global default. */
export function resolveLevel(state: VerbosityState, sessionID: string | undefined): Level {
  if (sessionID && state.sessions[sessionID] !== undefined) {
    return state.sessions[sessionID]
  }
  return state.default
}

export function nextLevel(level: Level): Level {
  return LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]
}

/**
 * True for GPT-5 family models. Excludes the `*-chat*` models
 * (e.g. gpt-5-chat-latest, gpt-5.2-chat-latest) because they only accept
 * "medium" verbosity - OpenCode itself excludes them the same way.
 */
export function isGpt5Model(modelID: string | undefined): boolean {
  if (!modelID) {
    return false
  }
  const id = modelID.toLowerCase()
  return id.includes("gpt-5") && !id.includes("chat")
}
