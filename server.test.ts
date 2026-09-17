import assert from "node:assert/strict";
import { test } from "node:test";
import type { Plugin } from "@opencode/plugin";
import plugin from "./server";

const kinds = ["context", "compaction", "generate", "title"] as const;
type Request = {
  sessionID: string;
  model: { providerID: string; id: string };
  options: Record<string, unknown>;
};
type Methods = Record<
  "get" | "cycle",
  (input: { sessionID?: string }) => Promise<unknown>
>;

async function setup() {
  const storage = new Map<string, unknown>();
  const hooks = new Map<string, (event: Request) => Promise<void>>();
  let methods!: Methods;
  let updates = 0;
  // Deliberately expose the 2.0.5 model API, with no legacy `catalog` property.
  const context = {
    storage: {
      get: async (key: string) => storage.get(key),
      set: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
    },
    model: {
      list: async () => ({
        data: [
          { providerID: "openai", id: "astra", modelID: "gpt-6-astra" },
          { providerID: "other", id: "astra", modelID: "claude-sonnet-4-6" },
        ],
      }),
    },
    rpc: {
      register: async (_definition: unknown, handlers: Methods) => {
        methods = handlers;
        return {
          events: {
            emit: async () => {
              updates++;
            },
          },
        };
      },
    },
    session: {
      hook: async (
        kind: string,
        callback: (event: Request) => Promise<void>,
      ) => {
        hooks.set(kind, callback);
      },
    },
  };
  await plugin.setup(context as unknown as Plugin.Context);
  return {
    storage,
    hooks,
    get methods() {
      return methods;
    },
    get updates() {
      return updates;
    },
  };
}

test("all request hooks apply verbosity through the 2.0.5 model API", async () => {
  const { storage, hooks } = await setup();
  storage.set("default", "low");
  storage.set("sessions/session-1", "high");
  assert.deepEqual([...hooks.keys()], [...kinds]);
  for (const kind of kinds) {
    const event: Request = {
      sessionID: "session-1",
      model: { providerID: "openai", id: "astra" },
      options: { temperature: 0.5 },
    };
    await hooks.get(kind)!(event);
    assert.deepEqual(event.options, {
      temperature: 0.5,
      textVerbosity: "high",
    });
  }
});

test("resolves model aliases by provider and skips unsupported models", async () => {
  const { storage, hooks } = await setup();
  storage.set("default", "medium");
  for (const [providerID, id, supported] of [
    ["openai", "astra", true],
    ["other", "astra", false],
    ["openai", "gpt-5", true],
    ["openai", "gpt-6-astra", true],
    ["openai", "gpt-5-chat-latest", false],
    ["anthropic", "claude-sonnet-4-6", false],
  ] as const) {
    const event: Request = {
      sessionID: "new",
      model: { providerID, id },
      options: {},
    };
    await hooks.get("context")!(event);
    assert.deepEqual(
      event.options,
      supported ? { textVerbosity: "medium" } : {},
    );
  }
});

test("unset preserves configured overrides, including a session overriding the default", async () => {
  const { storage, hooks } = await setup();
  storage.set("default", "high");
  storage.set("sessions/session-1", "unset");
  const event: Request = {
    sessionID: "session-1",
    model: { providerID: "openai", id: "gpt-6-astra" },
    options: { textVerbosity: "low" },
  };
  await hooks.get("context")!(event);
  assert.deepEqual(event.options, { textVerbosity: "low" });
});

test("concurrent cycles persist session preferences and publish updates", async () => {
  const fixture = await setup();
  assert.equal(await fixture.methods.get({}), "unset");
  assert.deepEqual(
    await Promise.all([
      fixture.methods.cycle({ sessionID: "one" }),
      fixture.methods.cycle({ sessionID: "one" }),
      fixture.methods.cycle({ sessionID: "one" }),
    ]),
    ["low", "medium", "high"],
  );
  assert.equal(await fixture.methods.get({ sessionID: "one" }), "high");
  assert.equal(await fixture.methods.get({ sessionID: "new" }), "high");
  assert.equal(await fixture.methods.cycle({ sessionID: "two" }), "unset");
  assert.equal(await fixture.methods.get({ sessionID: "one" }), "high");
  assert.equal(await fixture.methods.get({}), "unset");
  assert.equal(fixture.updates, 4);
});
