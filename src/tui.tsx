/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule, TuiTheme } from "@opencode-ai/plugin/tui"
import { Show, createMemo, createSignal } from "solid-js"
import * as fs from "node:fs"
import * as path from "node:path"
import {
  STATE_FILE,
  isGpt5Model,
  nextLevel,
  pluginStateDir,
  readState,
  resolveLevel,
  writeState,
  type VerbosityState,
} from "./state"

const COMMAND = "gpt-5-verbosity.cycle"

/**
 * TUI side of the plugin.
 *
 * - ctrl+v cycles verbosity (unset -> low -> medium -> high) for the current
 *   session, and remembers the last set level globally as the default for
 *   new sessions.
 * - The current level is rendered in the prompt footer row (the same row that
 *   shows "Agent · model provider · variant"), right-aligned. Nothing is shown
 *   when the level is unset or the current model is not a GPT-5 model.
 */

const tui: TuiPlugin = async (api) => {
  const [store, setStore] = createSignal<VerbosityState>({ default: "unset", sessions: {} })
  const [recent, setRecent] = createSignal<{ modelID: string; mtime: number } | undefined>(undefined)

  const stateDir = () => api.state.path.state

  const loadStore = () => {
    const dir = stateDir()
    if (dir) {
      setStore(readState(dir))
    }
  }

  // OpenCode persists the most recently selected model in <state>/model.json.
  const loadRecent = () => {
    const dir = stateDir()
    if (!dir) {
      return
    }
    try {
      const file = path.join(dir, "model.json")
      const stat = fs.statSync(file)
      const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
      const list = (raw as { recent?: unknown })?.recent
      const first = Array.isArray(list) ? (list[0] as { modelID?: unknown } | undefined) : undefined
      if (first && typeof first.modelID === "string") {
        setRecent({ modelID: first.modelID, mtime: stat.mtimeMs })
      }
    } catch {
      // ignore: file may not exist yet
    }
  }

  // The state directory is synced from the server and may not be known yet
  // when the plugin initializes, so retry until it is available.
  let stateWatcher: fs.FSWatcher | undefined
  let modelWatcher: fs.FSWatcher | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  const setup = () => {
    const dir = stateDir()
    if (!dir) {
      return false
    }
    loadStore()
    loadRecent()
    try {
      // Plugin files live in <state>/gpt-5-verbosity/.
      fs.mkdirSync(pluginStateDir(dir), { recursive: true })
      stateWatcher = fs.watch(pluginStateDir(dir), (_event, filename) => {
        if (filename === STATE_FILE) {
          loadStore()
        }
      })
      modelWatcher = fs.watch(dir, (_event, filename) => {
        if (filename === "model.json") {
          loadRecent()
        }
      })
    } catch {
      // directory watching is best-effort
    }
    return true
  }
  if (!setup()) {
    timer = setInterval(() => {
      if (!setup()) {
        return
      }
      clearInterval(timer)
      timer = undefined
    }, 250)
  }
  api.lifecycle.onDispose(() => {
    stateWatcher?.close()
    modelWatcher?.close()
    if (timer) {
      clearInterval(timer)
    }
  })

  const configModelID = () => {
    const model = api.state.config?.model
    if (typeof model !== "string" || !model.includes("/")) {
      return undefined
    }
    return model.split("/").slice(1).join("/")
  }

  /**
   * Best-effort detection of the model currently selected in the prompt.
   * Inside a session the prompt is initialized from the last message's model;
   * an explicit model switch afterwards updates <state>/model.json, so when
   * that file is newer than the last message it wins.
   */
  const currentModelID = (sessionID?: string) => {
    let fromMessage: { modelID: string; time: number } | undefined
    if (sessionID) {
      const messages = api.state.session.messages(sessionID)
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i] as {
          role: string
          time?: { created?: number }
          modelID?: string
          model?: { modelID?: string }
        }
        const modelID = message.role === "assistant" ? message.modelID : message.model?.modelID
        if (modelID) {
          fromMessage = { modelID, time: message.time?.created ?? 0 }
          break
        }
      }
    }
    const fromRecent = recent()
    if (fromMessage && fromRecent) {
      return fromRecent.mtime > fromMessage.time ? fromRecent.modelID : fromMessage.modelID
    }
    return fromMessage?.modelID ?? fromRecent?.modelID ?? configModelID()
  }

  const activeSessionID = () => {
    const route = api.route.current
    if (route.name !== "session") {
      return undefined
    }
    const sessionID = (route.params as { sessionID?: unknown } | undefined)?.sessionID
    return typeof sessionID === "string" ? sessionID : undefined
  }

  const cycle = () => {
    const dir = stateDir()
    if (!dir) {
      return
    }
    const sessionID = activeSessionID()
    // Only for GPT-5 models: no-op otherwise.
    if (!isGpt5Model(currentModelID(sessionID))) {
      return
    }

    const state = readState(dir)
    const next = nextLevel(sessionID ? resolveLevel(state, sessionID) : state.default)
    if (sessionID) {
      state.sessions[sessionID] = next
    }
    // The last set level is the global default for new sessions.
    state.default = next
    writeState(dir, state)
    setStore(state)
  }

  api.keymap.registerLayer({
    mode: "base",
    // Above the host prompt/paste layers so ctrl+v reaches this command.
    priority: 100,
    commands: [
      {
        name: COMMAND,
        title: "Cycle GPT-5 verbosity",
        desc: "Cycle text verbosity for GPT-5 models (unset → low → medium → high)",
        category: "Model",
        namespace: "palette",
        slashName: "verbosity",
        run() {
          cycle()
        },
      },
    ],
    bindings: [{ key: "ctrl+v", cmd: COMMAND, desc: "Cycle GPT-5 verbosity" }],
  })

  const Indicator = (props: { theme: TuiTheme; sessionID?: string }) => {
    const level = createMemo(() =>
      props.sessionID ? resolveLevel(store(), props.sessionID) : store().default,
    )
    const visible = createMemo(() => level() !== "unset" && isGpt5Model(currentModelID(props.sessionID)))
    return (
      <Show when={visible()}>
        <text fg={props.theme.current.textMuted}>
          verbosity{" "}
          <span style={{ fg: props.theme.current.info, bold: true }}>{level()}</span>
        </text>
      </Show>
    )
  }

  api.slots.register({
    slots: {
      session_prompt_right(ctx, value) {
        return <Indicator theme={ctx.theme} sessionID={value.session_id} />
      },
      home_prompt_right(ctx) {
        return <Indicator theme={ctx.theme} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "gpt-5-verbosity",
  tui,
}

export default plugin
