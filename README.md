# gpt-5-verbosity

[OpenCode](https://opencode.ai) plugin for controlling text verbosity on GPT-5 and GPT-6 models, including GPT-6 Astra.

- Hit **ctrl+v** to cycle: `unset → low → medium → high`
- The level shows up next to the prompt footer, nothing shown when unset
- Stored per session, and the last level you set becomes the default for new sessions
- Only touches GPT-5 and GPT-6 models. Does nothing for anything else; `*-chat*` variants are also skipped.
- Also in the command palette and as `/verbosity`

Needs OpenCode 2.0.3+.

## Install

Let opencode handle it:

```sh
opencode plugin add github:obedm503/gpt-5-verbosity
```

That installs the package globally. OpenCode loads the server plugin and its `./tui` entrypoint together. Restart OpenCode after installing.

### Manual (from a clone)

Prefer running from a local checkout? Clone it somewhere permanent and point your config at it:

```sh
git clone https://github.com/obedm503/gpt-5-verbosity.git ~/gpt-5-verbosity
```

`~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/home/YOU/gpt-5-verbosity"]
}
```

Use the package directory so OpenCode discovers both entrypoints. For project-local configuration, add the same entry to the project's `opencode.json` instead.

When connecting to a remote server, configure the server plugin there and load the terminal component locally in `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["/home/YOU/gpt-5-verbosity"]
}
```

For a local checkout, run `bun install` in the plugin directory. No build step is needed.

## V2 migration notes

- Replace old `plugin` entries with the `plugins` configuration above. Terminal configuration now lives in `cli.json`.
- Preferences use OpenCode's durable server-side plugin storage and synchronize with terminal clients through RPC. The V1 `gpt-5-verbosity/state.json` file is not imported; select your preferred level again after upgrading.
- In a session, model detection uses the session's selected model. On the home screen, it uses the configured default model.
- The verbosity setting applies to GPT-5 and GPT-6 agent requests, compaction, title generation, and transient generation. `unset` leaves the configured model defaults in effect.

## Development

```sh
bun install
bun run typecheck
```

> ctrl+v normally pastes in OpenCode — this takes it over. Terminal paste (ctrl+shift+v, cmd+v) still works fine.
