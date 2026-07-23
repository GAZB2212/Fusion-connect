// Islamic profile prompts (Hinge-style) — members answer a couple to spark
// meaningful conversation. Mirrors the web app's prompt set.
export interface Prompt {
  id: string;
  prompt: string;
}

export const PROMPTS: Prompt[] = [
  { id: "favorite_surah", prompt: "My favourite Surah is…" },
  { id: "islamic_value", prompt: "The Islamic value I live by…" },
  { id: "prayer_meaning", prompt: "What prayer means to me…" },
  { id: "ramadan_memories", prompt: "My favourite Ramadan memory…" },
  { id: "eid_celebration", prompt: "My ideal Eid celebration looks like…" },
  { id: "family_tradition", prompt: "A family tradition I love…" },
  { id: "future_family", prompt: "In our future home, I hope we…" },
  { id: "perfect_weekend", prompt: "My perfect halal weekend includes…" },
  { id: "travel_dreams", prompt: "A place I dream of visiting…" },
  { id: "relationship_priority", prompt: "In a marriage, I prioritise…" },
];

export function promptText(id: string): string {
  return PROMPTS.find((p) => p.id === id)?.prompt || "About me…";
}
