export const LEVELS = ["unset", "low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

export function isLevel(value: unknown): value is Level {
  return (
    typeof value === "string" && (LEVELS as readonly string[]).includes(value)
  );
}

export function nextLevel(level: Level): Level {
  return LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
}

/** GPT-5 and GPT-6 families, excluding chat variants. */
export function supportsVerbosity(modelID: string | undefined): boolean {
  const id = modelID?.toLowerCase();
  return (
    !!id &&
    (id.includes("gpt-5") || id.includes("gpt-6")) &&
    !id.includes("chat")
  );
}
