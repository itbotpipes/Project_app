"use client";

import { useState } from "react";
import { postBirthdayWish } from "@/lib/actions/social";

type Person = { id: string; name: string };
export type Wish = { id: string; from: string; body: string; tagged: string[]; when: string };

export default function BirthdayWishes({
  target,
  inDays,
  people,
  wishes,
  selfId,
}: {
  target: Person;
  inDays: number;
  people: Person[];
  wishes: Wish[];
  selfId: string;
}) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [list, setList] = useState<Wish[]>(wishes);
  const [picker, setPicker] = useState(false);

  const isSelf = target.id === selfId;
  const when = inDays === 0 ? "today 🎉" : inDays === 1 ? "tomorrow" : `in ${inDays} days`;
  const tagPeople = people.filter((p) => p.id !== selfId && p.id !== target.id);
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  async function submit(fd: FormData) {
    const body = String(fd.get("body") || "").trim();
    if (!body) return;
    setList((l) => [
      { id: `tmp-${Date.now()}`, from: "You", body, tagged: tags.map((id) => nameById.get(id) ?? ""), when: "just now" },
      ...l,
    ]);
    setText("");
    setTags([]);
    setPicker(false);
    await postBirthdayWish(fd);
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="mb-2 text-xs font-semibold text-slate-600">
        🎂 Wish <span className="text-pink-600">{isSelf ? "the team back" : target.name.split(" ")[0]}</span>{" "}
        <span className="font-normal text-slate-400">· birthday {when}</span>
      </div>

      {!isSelf && (
        <form action={submit} className="space-y-2">
          <input type="hidden" name="forId" value={target.id} />
          {tags.map((id) => (
            <input key={id} type="hidden" name="taggedIds" value={id} />
          ))}
          <textarea
            name="body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={`Happy birthday, ${target.name.split(" ")[0]}! 🎉`}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-pink-400"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-xs text-pink-700">
                  @{nameById.get(id)?.split(" ")[0]}
                  <button type="button" onClick={() => setTags((t) => t.filter((x) => x !== id))} className="text-pink-400 hover:text-pink-600">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicker((p) => !p)}
              className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              @ Tag people
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-full bg-pink-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Post wish
            </button>
          </div>
          {picker && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-1">
              {tagPeople.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setTags((t) => (t.includes(p.id) ? t : [...t, p.id]))
                  }
                  className="block w-full rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-pink-50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </form>
      )}

      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((w) => (
            <li key={w.id} className="rounded-lg bg-pink-50/60 px-3 py-1.5 text-sm">
              <span className="font-semibold text-slate-700">{w.from}</span>{" "}
              <span className="text-[10px] text-slate-400">{w.when}</span>
              <p className="whitespace-pre-wrap break-words text-slate-700">{w.body}</p>
              {w.tagged.length > 0 && (
                <div className="mt-0.5 text-xs text-pink-600">
                  {w.tagged.map((n) => `@${n.split(" ")[0]}`).join(" ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
