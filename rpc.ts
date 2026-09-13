import { Rpc } from "@opencode/plugin/rpc";
import { LEVELS } from "./state";

const input = {
  type: "object",
  properties: { sessionID: { type: "string" } },
  additionalProperties: false,
} as const;

const output = { type: "string", enum: [...LEVELS] } as const;

export const Verbosity = Rpc.define({
  id: "gpt-5-verbosity",
  methods: {
    get: { input, output },
    cycle: { input, output },
  },
  events: {
    updated: { schema: { type: "object", additionalProperties: false } },
  },
});
