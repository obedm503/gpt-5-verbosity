# gpt-5-verbosity

[OpenCode](https://opencode.ai) plugin for controlling text verbosity on GPT-5 models.

- Hit **ctrl+v** to cycle: `unset → low → medium → high`
- The level shows up next to the prompt footer, nothing shown when unset
- Stored per session, and the last level you set becomes the default for new sessions
- Only touches GPT-5 models. Does nothing for anything else (`*-chat*` models are skipped too, they only support `medium`)
- Also in the command palette and as `/verbosity`

Needs OpenCode 1.18+.

## Install

Let opencode handle it:

```sh
opencode plugin github:obedm503/gpt-5-verbosity -g
```

That installs the package and adds it to both `~/.config/opencode/opencode.json` and `~/.config/opencode/tui.json`. Drop the `-g` to set it up for just the current project. Restart OpenCode and you're done.

### Manual (from a clone)

Prefer running from a local checkout? Clone it somewhere permanent and point your config at it:

```sh
git clone https://github.com/obedm503/gpt-5-verbosity.git ~/gpt-5-verbosity
```

`~/.config/opencode/opencode.json`

```json
{
  "plugin": ["/home/YOU/gpt-5-verbosity/src/server.ts"]
}
```

`~/.config/opencode/tui.json`

```json
{
  "plugin": ["/home/YOU/gpt-5-verbosity/src/tui.tsx"]
}
```

No build step, no `bun install` needed.

> ctrl+v normally pastes in OpenCode — this takes it over. Terminal paste (ctrl+shift+v, cmd+v) still works fine.
