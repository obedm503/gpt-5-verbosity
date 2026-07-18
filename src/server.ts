import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { isGpt5Model, readState, resolveLevel } from "./state"

/**
 * Server side of the plugin. Applies the stored verbosity level to every
 * request made with a GPT-5 model by setting the `textVerbosity` option
 * (the same flat option key OpenCode uses internally for GPT-5 models).
 */
const server: Plugin = async ({ client }) => {
  let stateDir: string | undefined

  return {
    "chat.params": async (input, output) => {
      // `api.id` is the id sent to the provider API; fall back to the model id.
      const modelID = input.model.api?.id ?? input.model.id
      if (!isGpt5Model(modelID)) {
        return
      }

      if (!stateDir) {
        const result = await client.path.get()
        stateDir = result.data?.state
      }
      if (!stateDir) {
        return
      }

      const level = resolveLevel(readState(stateDir), input.sessionID)
      if (level === "unset") {
        return
      }

      output.options.textVerbosity = level
    },
  }
}

const plugin: PluginModule & { id: string } = {
  id: "gpt-5-verbosity",
  server,
}

export default plugin
