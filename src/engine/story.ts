/** Creative intent only: generated text never authorizes geometry or capabilities. */
export type Story = {
  title: string;
  intent: string;
  beats: Record<string, string>;
};
export function parseStory(value: unknown): Story {
  if (!value || typeof value !== "object")
    throw new Error(
      "The director returned an incomplete story. Try another idea.",
    );
  const item = value as Record<string, unknown>;
  const valid = (text: unknown, limit: number): text is string =>
    typeof text === "string" && text.trim().length > 0 && text.length <= limit;
  if (
    !valid(item.title, 100) ||
    !valid(item.intent, 1000) ||
    !item.beats ||
    typeof item.beats !== "object"
  )
    throw new Error(
      "The director returned an incomplete story. Try another idea.",
    );
  const beats: Record<string, string> = {};
  for (const id of ["arrival", "discovery", "farewell", "departure"]) {
    const text = (item.beats as Record<string, unknown>)[id];
    if (!valid(text, 600))
      throw new Error(
        "The story is missing a dramatic beat. Try another idea.",
      );
    beats[id] = text.trim();
  }
  return { title: item.title.trim(), intent: item.intent.trim(), beats };
}
export async function composeStory(prompt: string): Promise<Story> {
  const response = await fetch("/api/creative-director", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    if (response.status === 503)
      throw new Error(
        "Creative direction is not connected yet. Your current performance is unchanged.",
      );
    throw new Error(
      "The creative director could not finish this story. Please try again.",
    );
  }
  return parseStory(await response.json());
}
