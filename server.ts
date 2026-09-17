import { Plugin } from "@opencode/plugin";
import { Verbosity } from "./rpc";
import { isLevel, nextLevel, supportsVerbosity } from "./state";

export default Plugin.define({
  id: "gpt-5-verbosity",
  async setup(ctx) {
    const read = async (sessionID?: string) => {
      if (sessionID) {
        const level = await ctx.storage.get(`sessions/${sessionID}`);
        if (isLevel(level)) {
          return level;
        }
      }
      const level = await ctx.storage.get("default");
      return isLevel(level) ? level : "unset";
    };
    // Serialize read-modify-write operations from multiple terminal clients.
    let pending = Promise.resolve();
    const registration = await ctx.rpc.register(Verbosity, {
      get: (input) => {
        const { sessionID } = input as { sessionID?: string };
        return read(sessionID);
      },
      cycle: (input) => {
        const { sessionID } = input as { sessionID?: string };
        const operation = pending.then(async () => {
          const level = nextLevel(await read(sessionID));
          if (sessionID) {
            await ctx.storage.set(`sessions/${sessionID}`, level);
          }
          await ctx.storage.set("default", level);
          await registration.events.emit("updated", {});
          return level;
        });
        pending = operation.then(
          () => {},
          () => {},
        );
        return operation;
      },
    });

    for (const kind of [
      "context",
      "compaction",
      "generate",
      "title",
    ] as const) {
      await ctx.session.hook(kind, async (event) => {
        const models = await ctx.model.list();
        const model = models.data.find(
          (model) =>
            model.providerID === event.model.providerID &&
            model.id === event.model.id,
        );
        if (!supportsVerbosity(model?.modelID ?? event.model.id)) {
          return;
        }

        const level = await read(event.sessionID);
        if (level !== "unset") {
          event.options.textVerbosity = level;
        }
      });
    }
  },
});
