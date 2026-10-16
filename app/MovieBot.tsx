"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CatalogVideo = {
  title: string;
  category: string;
  year: string;
  description: string;
  youtubeId: string;
};

type Pick = { title: string; year: string; why: string };

type Entry =
  | { kind: "me"; id: number; text: string }
  | { kind: "bot"; id: number; intro: string; picks: Pick[]; source: string }
  | { kind: "error"; id: number; text: string };

type Props = {
  roomCode: string;
  displayName: string;
  catalog: CatalogVideo[];
  playlistTitles: string[];
  pollQuestion: string;
  onPlay: (youtubeId: string) => void;
  onAddToPlaylist: (youtubeId: string) => void;
};

// Small helper so the strict lint rules accept a click-time clock read
function nowMs(): number {
  return Date.now();
}

const QUICK = ["Something funny", "Mind-bending sci-fi", "Cozy night for two"];

const BUBBLES = [
  "Need help picking a movie?",
  "Hi! Ask me for a film.",
  "Not sure what to watch? Ask me!",
  "I can pick movies for the whole room.",
];

export default function MovieBot({
  roomCode,
  displayName,
  catalog,
  playlistTitles,
  pollQuestion,
  onPlay,
  onAddToPlaylist,
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareToChat, setShareToChat] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const lastAskRef = useRef(0);
  const [bubble, setBubble] = useState<number | null>(null);

  // The robot pops up a little speech bubble every now and then
  useEffect(() => {
    if (open || entries.length > 0) return;
    try {
      if (sessionStorage.getItem("wp-bot-chatted") === "1") return;
    } catch {}
    let i = 0;
    let hide = 0;
    const show = () => {
      setBubble(i % BUBBLES.length);
      i += 1;
      hide = window.setTimeout(() => setBubble(null), 5000);
    };
    const first = window.setTimeout(show, 2500);
    const loop = window.setInterval(show, 12000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
      window.clearTimeout(hide);
    };
  }, [open, entries.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries, loading, open]);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  async function postToChat(sender: string, content: string) {
    const { error } = await supabase.from("messages").insert({
      room_code: roomCode,
      sender_name: sender,
      content: content.slice(0, 500),
    });
    if (error) console.error("Bot chat post failed:", error.message);
  }

  async function ask(raw: string) {
    const question = raw.trim().slice(0, 300);
    if (!question || loading) return;

    const waitMs = 8000 - (nowMs() - lastAskRef.current);
    if (waitMs > 0) {
      setEntries((cur) => [
        ...cur,
        {
          kind: "error",
          id: nextId(),
          text: `Give the bot a moment (${Math.ceil(waitMs / 1000)}s).`,
        },
      ]);
      return;
    }
    lastAskRef.current = nowMs();
    try {
      sessionStorage.setItem("wp-bot-chatted", "1");
    } catch {}

    const history = entries
      .slice(-6)
      .map((e) => {
        if (e.kind === "me") return { role: "user", text: e.text };
        if (e.kind === "bot") {
          const titles = e.picks.map((p) => p.title).join(", ");
          return {
            role: "assistant",
            text: `${e.intro} ${titles ? "(suggested: " + titles + ")" : ""}`.trim(),
          };
        }
        return null;
      })
      .filter((x): x is { role: string; text: string } => x !== null);

    setInput("");
    setLoading(true);
    setEntries((cur) => [...cur, { kind: "me", id: nextId(), text: question }]);

    try {
      const res = await fetch("/api/movie-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          roomCode,
          catalog,
          playlist: playlistTitles,
          pollQuestion,
          history,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        intro?: string;
        picks?: Pick[];
        source?: string;
      };

      if (!res.ok || !data.picks) {
        setEntries((cur) => [
          ...cur,
          {
            kind: "error",
            id: nextId(),
            text: data.error ?? "The bot could not answer. Try again.",
          },
        ]);
        return;
      }

      const intro = data.intro ?? "";
      const picks = data.picks;
      setEntries((cur) => [
        ...cur,
        { kind: "bot", id: nextId(), intro, picks, source: data.source ?? "ai" },
      ]);

      if (shareToChat && picks.length > 0) {
        const list = picks
          .map((p) => (p.year ? `${p.title} (${p.year})` : p.title))
          .join(" / ");
        void (async () => {
          await postToChat(displayName, `@movie ${question}`);
          await postToChat("MovieBot", `${intro} ${list}`.trim());
        })();
      }
    } catch (err) {
      console.error("Movie bot request failed:", err);
      setEntries((cur) => [
        ...cur,
        { kind: "error", id: nextId(), text: "Could not reach the bot. Check your connection." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const findInCatalog = (title: string) =>
    catalog.find((c) => c.title.toLowerCase() === title.toLowerCase());

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[480px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                Movie bot
              </p>
              <p className="text-[11px] text-zinc-500">
                Suggestions for the whole room
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close movie bot"
              className="text-zinc-500 hover:text-white"
            >
              x
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {entries.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-3 text-xs text-zinc-400">
                Hi, I am your movie buddy! Say hello, chat with me, or tell me a mood and I will pick something for everyone.
              </div>
            )}

            {entries.map((entry) => {
              if (entry.kind === "me") {
                return (
                  <div key={entry.id} className="ml-8 rounded-xl bg-red-600/20 px-3 py-2 text-sm">
                    {entry.text}
                  </div>
                );
              }
              if (entry.kind === "error") {
                return (
                  <div key={entry.id} className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-red-300">
                    {entry.text}
                  </div>
                );
              }
              return (
                <div key={entry.id} className="space-y-2">
                  {entry.intro && (
                    <p className="text-sm text-zinc-300">{entry.intro}</p>
                  )}
                  {entry.picks.map((pick) => {
                    const match = findInCatalog(pick.title);
                    return (
                      <div
                        key={`${entry.id}-${pick.title}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <p className="text-sm font-bold">
                          {pick.title}
                          {pick.year ? (
                            <span className="ml-1 text-xs font-normal text-zinc-500">
                              {pick.year}
                            </span>
                          ) : null}
                        </p>
                        {pick.why && (
                          <p className="mt-1 text-xs text-zinc-400">{pick.why}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {match ? (
                            <>
                              <button
                                onClick={() => onPlay(match.youtubeId)}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold hover:bg-red-500"
                              >
                                Play for everyone
                              </button>
                              <button
                                onClick={() => onAddToPlaylist(match.youtubeId)}
                                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                              >
                                + Playlist
                              </button>
                            </>
                          ) : (
                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                                `${pick.title} ${pick.year} official trailer`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                            >
                              Find on YouTube
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {entry.source === "fallback" && (
                    <p className="text-[10px] text-zinc-600">
                      Picked from the watch list without AI.
                    </p>
                  )}
                </div>
              );
            })}

            {loading && (
              <p className="animate-pulse text-xs text-zinc-500">Typing...</p>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 p-3">
            {entries.length === 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => void ask(q)}
                  disabled={loading}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void ask(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={300}
                placeholder={entries.length === 0 ? "Say hi, or ask for a movie..." : "Type a message..."}
                aria-label="Ask the movie bot"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500"
              />
              <button
                disabled={loading}
                className="rounded-xl bg-red-600 px-3 text-sm font-bold hover:bg-red-500 disabled:opacity-40"
              >
                Ask
              </button>
            </form>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
              <input
                type="checkbox"
                checked={shareToChat}
                onChange={(event) => setShareToChat(event.target.checked)}
              />
              Also post to the room chat so everyone sees it
            </label>
          </div>
        </div>
      )}

      <div className="relative flex items-end">
        {!open && entries.length === 0 && bubble !== null && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setOpen(true);
            }}
            className="wp-bubble-pop absolute bottom-12 right-[84px] w-max max-w-[210px] cursor-pointer rounded-2xl bg-white px-4 py-2.5 text-left text-sm font-semibold text-black shadow-xl"
          >
            {BUBBLES[bubble]}
            <span className="absolute -right-1.5 bottom-3 h-3 w-3 rotate-45 bg-white" />
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={open ? "Close movie bot" : "Open movie bot"}
          onClick={() => setOpen((cur) => !cur)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setOpen((cur) => !cur);
          }}
          className="relative h-28 w-24 cursor-pointer select-none transition-transform hover:scale-105 active:scale-95"
        >
          <div className="wp-bot-float">
            <svg
              viewBox="0 0 96 112"
              className="h-28 w-24 drop-shadow-[0_8px_14px_rgba(220,38,38,0.35)]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="wpbot-head" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#d4d4d8" />
                </linearGradient>
                <linearGradient id="wpbot-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f87171" />
                  <stop offset="1" stopColor="#b91c1c" />
                </linearGradient>
                <radialGradient id="wpbot-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stopColor="#ef4444" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="48" cy="106" rx="24" ry="4" fill="#000" opacity="0.35" />
              <line x1="48" y1="16" x2="48" y2="26" stroke="#a1a1aa" strokeWidth="3" strokeLinecap="round" />
              <circle className="wp-bot-glow" cx="48" cy="12" r="9" fill="url(#wpbot-glow)" />
              <circle cx="48" cy="12" r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
              <rect x="9" y="38" width="8" height="18" rx="4" fill="#b91c1c" />
              <rect x="79" y="38" width="8" height="18" rx="4" fill="#b91c1c" />
              <rect x="14" y="24" width="68" height="46" rx="18" fill="url(#wpbot-head)" stroke="#a1a1aa" strokeWidth="1.5" />
              <rect x="21" y="31" width="54" height="32" rx="13" fill="#0b0b10" />
              <rect x="24" y="33" width="48" height="8" rx="4" fill="#fff" opacity="0.06" />
              <ellipse className="wp-bot-eye" cx="38" cy="45" rx="6" ry="7.5" fill="#ef4444" />
              <ellipse className="wp-bot-eye" cx="58" cy="45" rx="6" ry="7.5" fill="#ef4444" />
              <circle cx="40" cy="42.5" r="2" fill="#fff" />
              <circle cx="60" cy="42.5" r="2" fill="#fff" />
              <path d="M41 55 Q48 61 55 55" fill="none" stroke="#ef4444" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="30" cy="53" r="3" fill="#fb7185" opacity="0.55" />
              <circle cx="66" cy="53" r="3" fill="#fb7185" opacity="0.55" />
              <rect x="28" y="72" width="40" height="28" rx="13" fill="url(#wpbot-body)" stroke="#7f1d1d" strokeWidth="1.2" />
              <circle cx="48" cy="85" r="6" fill="#0b0b10" />
              <path d="M45.5 82.5 L52 85 L45.5 87.5 Z" fill="#fff" />
              <rect x="21" y="76" width="9" height="20" rx="4.5" fill="#f87171" stroke="#7f1d1d" strokeWidth="1" />
              <g className="wp-bot-wave">
                <rect x="67" y="64" width="9" height="22" rx="4.5" fill="#f87171" stroke="#7f1d1d" strokeWidth="1" transform="rotate(28 71 86)" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
