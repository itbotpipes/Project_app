// Shared, non-server constant (a "use server" file may only export async fns).
export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
