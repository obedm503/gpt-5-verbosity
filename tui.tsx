/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { Show, createResource, createSignal } from "solid-js";
import { Verbosity } from "./rpc";
import { isLevel, supportsVerbosity } from "./state";

const COMMAND = "gpt-5-verbosity.cycle";

export default Plugin.define({
  id: "gpt-5-verbosity",
  setup(ctx) {
    const rpc = ctx.client.rpc(Verbosity);
    const location = () => ctx.location ?? ctx.data.location.default();
    const [revision, setRevision] = createSignal(0);
    const reportError = (error: unknown) => {
      ctx.ui.toast.show({
        title: "GPT verbosity",
        message: errorMessage(error),
        variant: "error",
      });
    };
    const refresh = () => {
      setRevision((value) => value + 1);
    };
    const stop = rpc.events.on("updated", refresh);

    const [defaultModel] = createResource(location, async (location) => {
      try {
        const result = await ctx.client.model.default({ location });
        return result.data;
      } catch (error) {
        reportError(error);
        return undefined;
      }
    });
    const currentModelID = (sessionID?: string) => {
      const ref = sessionID
        ? ctx.data.session.get(sessionID)?.model
        : defaultModel();
      if (!ref) {
        return undefined;
      }
      const model = ctx.data.location.model
        .list(location())
        ?.find(
          (model) => model.providerID === ref.providerID && model.id === ref.id,
        );
      return model?.modelID ?? ref.id;
    };
    const activeSessionID = () => {
      const route = ctx.ui.router.current();
      return route.type === "session" ? route.sessionID : undefined;
    };

    const removeApp = ctx.ui.slot({
      append: "app",
      render: () => {
        ctx.keymap.layer(() => ({
          mode: "global",
          priority: 100,
          commands: [
            {
              id: COMMAND,
              title: "Cycle GPT verbosity",
              group: "Model",
              bind: "ctrl+v",
              palette: true,
              slash: { name: "verbosity" },
              run: async () => {
                const sessionID = activeSessionID();
                if (!supportsVerbosity(currentModelID(sessionID))) {
                  return;
                }
                try {
                  await rpc.cycle({ sessionID }, { location: location() });
                  refresh();
                } catch (error) {
                  reportError(error);
                }
              },
            },
          ],
          bindings: [COMMAND],
        }));
        return null;
      },
    });

    const Indicator = (props: { sessionID?: string }) => {
      const [level] = createResource(
        () => ({
          sessionID: props.sessionID,
          location: location(),
          revision: revision(),
        }),
        async ({ sessionID, location }) => {
          try {
            const level = await rpc.get({ sessionID }, { location });
            return isLevel(level) ? level : "unset";
          } catch (error) {
            reportError(error);
            return "unset";
          }
        },
        { initialValue: "unset" },
      );
      return (
        <Show
          when={
            level() !== "unset" &&
            supportsVerbosity(currentModelID(props.sessionID))
          }
        >
          <box flexGrow={1} flexShrink={0} alignItems="flex-end">
            <text fg={ctx.theme.text.subdued}>
              verbosity{" "}
              <span
                style={{ fg: ctx.theme.text.feedback.info.default, bold: true }}
              >
                {level()}
              </span>
            </text>
          </box>
        </Show>
      );
    };
    const removeSlot = ctx.ui.slot({
      append: "prompt.footer.file",
      render: (props) => <Indicator sessionID={props.sessionID} />,
    });
    return () => {
      stop();
      removeApp();
      removeSlot();
    };
  },
});

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    try {
      return JSON.stringify(error) ?? "Unknown error";
    } catch {
      return "Unknown error";
    }
  }
  return String(error);
}
