
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import MovieBot from "./MovieBot";

import dynamic from "next/dynamic";

const LiveGlobe = dynamic(() => import("./LiveGlobe"), { ssr: false });

type Video = {
  id: string;
  title: string;
  category: string;
  year: string;
  duration: string;
  description: string;
  color: string;
  youtubeId: string;
};

const videos: Video[] = [
  {
    id: "interstellar",
    title: "Interstellar",
    category: "Sci-Fi",
    year: "2014",
    duration: "2h 49m",
    description: "A journey beyond the stars, and everything we call home.",
    color: "from-indigo-950 via-slate-900 to-orange-950",
    youtubeId: "zSWdZVtXT7E",
  },
  {
    id: "inception",
    title: "Inception",
    category: "Thriller",
    year: "2010",
    duration: "2h 28m",
    description: "How deep can you go inside a dream?",
    color: "from-blue-950 via-slate-900 to-zinc-800",
    youtubeId: "YoHD9XEInc0",
  },
  {
    id: "dune",
    title: "Dune: Part Two",
    category: "Sci-Fi",
    year: "2024",
    duration: "2h 46m",
    description: "The future belongs to those who dare to dream.",
    color: "from-amber-950 via-stone-900 to-orange-950",
    youtubeId: "Way9Dexny3w",
  },
  {
    id: "spiderverse",
    title: "Across the Spider-Verse",
    category: "Animation",
    year: "2023",
    duration: "2h 20m",
    description: "Leap into a universe of endless possibilities.",
    color: "from-fuchsia-950 via-purple-950 to-blue-950",
    youtubeId: "cqGjhVJWtEg",
  },
  {
    id: "oppenheimer",
    title: "Oppenheimer",
    category: "Drama",
    year: "2023",
    duration: "3h",
    description: "The story of a world-changing moment.",
    color: "from-red-950 via-stone-900 to-amber-950",
    youtubeId: "uYPbbksJxIg",
  },
  {
    id: "nature",
    title: "Planet Earth",
    category: "Documentary",
    year: "2006",
    duration: "58 min",
    description: "Experience the extraordinary beauty of our planet.",
    color: "from-emerald-950 via-teal-950 to-blue-950",
    youtubeId: "c8aFcHFu8QM",
  },
];

const categories = [
  "All",
  "Sci-Fi",
  "Thriller",
  "Animation",
  "Drama",
  "Documentary",
];


type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  cueVideoById: (id: string) => void;
  getVideoData: () => { video_id: string };
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, options: object) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type SyncMessage = {
  action: "play" | "pause" | "sync";
  time: number;
  playing?: boolean;
  sentAt: number;
};

function videoFromYoutubeId(youtubeId: string): Video {
  return (
    videos.find((video) => video.youtubeId === youtubeId) ?? {
      id: `custom-${youtubeId}`,
      title: "Your YouTube selection",
      category: "Community",
      year: "YouTube",
      duration: "Video",
      description: "Added from your YouTube link.",
      color: "from-red-950 via-zinc-900 to-black",
      youtubeId,
    }
  );
}

async function fetchYoutubeTitle(youtubeId: string): Promise<string | null> {
  try {
    const res = await fetch(
      "https://www.youtube.com/oembed?format=json&url=" +
        encodeURIComponent("https://www.youtube.com/watch?v=" + youtubeId)
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: string };
    return json.title ?? null;
  } catch {
    return null;
  }
}

function parseYoutubeId(input: string): string | null {
  const text = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text.startsWith("http") ? text : "https://" + text);
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      id = url.searchParams.get("v") || "";
      if (!id) {
        const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/);
        if (m) id = m[1];
      }
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function thumbUrl(youtubeId: string) {
  return "https://i.ytimg.com/vi/" + youtubeId + "/mqdefault.jpg";
}

function ScrambleText({ text }: { text: string }) {
  const [display, setDisplay] = useState(text);
  const [scrambling, setScrambling] = useState(false);
  const timerRef = useRef<number | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  const run = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    const glyphs = "01<>/\\[]{}#$%&*+=?!";
    let frame = 0;
    setScrambling(true);
    timerRef.current = window.setInterval(() => {
      frame += 1;
      const locked = Math.floor(frame / 3);
      if (locked >= text.length) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setDisplay(text);
        setScrambling(false);
        return;
      }
      setDisplay(
        text
          .split("")
          .map((ch, i) =>
            ch === " " || i < locked
              ? ch
              : glyphs[Math.floor(Math.random() * glyphs.length)]
          )
          .join("")
      );
    }, 45);
  }, [text]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) run();
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [run]);

  return (
    <span
      ref={spanRef}
      aria-label={text}
      onMouseEnter={run}
      className={`wp-scramble ${scrambling ? "wp-scrambling" : ""}`}
    >
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

function IntroSplash() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);

  // Play the intro by itself: fade out at 9.4 s, gone at 10 s
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = window.setTimeout(() => setShow(false), 0);
      return () => window.clearTimeout(t);
    }
    const fade = window.setTimeout(() => setLeaving(true), 9400);
    const done = window.setTimeout(() => setShow(false), 10000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, []);

  // Stop the page scrolling behind the intro
  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="wp-intro-glow absolute h-[60vmin] w-[60vmin] rounded-full bg-red-600/30 blur-3xl" />
      <div
        className={`relative flex flex-col items-center px-6 transition-all duration-500 ${
          leaving ? "scale-150 opacity-0" : ""
        }`}
      >
        <div className="wp-intro-logo flex h-24 w-24 items-center justify-center rounded-3xl bg-red-600 text-6xl font-black shadow-2xl shadow-red-600/40">
          W
        </div>
        <div className="wp-intro-word mt-8 text-center text-4xl font-extrabold uppercase sm:text-6xl">
          <span className="text-white">watch</span>{" "}
          <span className="text-red-500">party</span>
        </div>
        <p className="wp-intro-tag mt-4 text-center text-xs uppercase tracking-[0.3em] text-zinc-400">
          Same screen. Same moment. Different couches.
        </p>
        <div className="wp-intro-sweep" />
      </div>
    </div>
  );
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

function CommunitySection({
  onWatch,
  onAdd,
}: {
  onWatch: (video: Video) => void;
  onAdd: (video: Video) => void;
}) {
  type Top = { youtubeId: string; title: string; count: number };
  const [stats, setStats] = useState<{
    rooms: number;
    messages: number;
    videos: number;
    votes: number;
  } | null>(null);
  const [top, setTop] = useState<Top[]>([]);
  const [loaded, setLoaded] = useState(false);
  const titlesRef = useRef<Map<string, string>>(new Map());

  // 3D orbit carousel state
  const [target, setTarget] = useState(0);
  const [angle, setAngle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewW, setViewW] = useState(1200);

  // wp-preview-c: rest the cursor on a Community card; the preview starts right away and loops 8 s
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const previewTimerRef = useRef(0);

  function startPreview(id: string) {
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewReady(false);
      setPreviewKey((k) => k + 1);
      setPreviewId(id);
    }, 80);
  }

  function stopPreview() {
    window.clearTimeout(previewTimerRef.current);
    setPreviewId(null);
    setPreviewReady(false);
  }

  useEffect(() => {
    if (!previewId) return;
    const t = window.setInterval(() => {
      setPreviewReady(false);
      setPreviewKey((k) => k + 1);
    }, 8500);
    return () => window.clearInterval(t);
  }, [previewId]);

  // wp-clean-preview: show the preview only once the video is really playing
  useEffect(() => {
    if (!previewId) return;
    const onMessage = (e: MessageEvent) => {
      if (!String(e.origin).includes("youtube")) return;
      if (wpEmbedPlaying(e.data)) setPreviewReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewId]);

  const previewLayer = (youtubeId: string, title: string) =>
    previewId === youtubeId ? (
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden bg-black transition-opacity duration-300 ${
          previewReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <iframe
                        key={previewKey}
                        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&cc_load_policy=0&enablejsapi=1&start=25&origin=${encodeURIComponent(window.location.origin)}`}
                        title="preview"
                        allow="autoplay; encrypted-media"
                        tabIndex={-1}
                        onLoad={(event) => {
                          event.currentTarget.contentWindow?.postMessage(
                            JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
                            "*"
                          );
                          window.setTimeout(() => setPreviewReady(true), 3000);
                        }}
                        className="absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none"
                      />
                      <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/80 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-black/90 to-transparent" />
      </div>
    ) : null;

  useEffect(() => {
    let cancelled = false;

    const countRows = async (table: string) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return error ? 0 : count ?? 0;
    };

    const load = async () => {
      const [rooms, messages, videosQueued, votes] = await Promise.all([
        countRows("rooms"),
        countRows("messages"),
        countRows("playlist_items"),
        countRows("poll_votes"),
      ]);
      const { data } = await supabase
        .from("playlist_items")
        .select("youtube_id, title")
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;

      const tally = new Map<string, Top>();
      ((data ?? []) as Array<{ youtube_id: string; title: string | null }>).forEach(
        (row) => {
          const known = videos.find((v) => v.youtubeId === row.youtube_id);
          const saved =
            row.title && row.title !== "Your YouTube selection" ? row.title : "";
          const entry = tally.get(row.youtube_id);
          if (entry) {
            entry.count += 1;
            if (!entry.title && saved) entry.title = saved;
          } else {
            tally.set(row.youtube_id, {
              youtubeId: row.youtube_id,
              title:
                known?.title ||
                saved ||
                titlesRef.current.get(row.youtube_id) ||
                "",
              count: 1,
            });
          }
        }
      );
      const ranked = [...tally.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setStats({ rooms, messages, videos: videosQueued, votes });
      setTop(ranked);
      setLoaded(true);

      ranked.forEach((item) => {
        if (item.title || titlesRef.current.has(item.youtubeId)) return;
        titlesRef.current.set(item.youtubeId, "");
        void fetchYoutubeTitle(item.youtubeId).then((title) => {
          if (cancelled) return;
          const t = title || "YouTube video";
          titlesRef.current.set(item.youtubeId, t);
          setTop((cur) =>
            cur.map((x) =>
              x.youtubeId === item.youtubeId && !x.title ? { ...x, title: t } : x
            )
          );
        });
      });
    };

    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const featured = top.slice(0, 4);
  const rest = top.slice(4);
  const n = featured.length;

  // screen width, so the orbit fits phones too
  useEffect(() => {
    const update = () => setViewW(window.innerWidth);
    const t = window.setTimeout(update, 0);
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", update);
    };
  }, []);

  // keep the latest target in a ref so the animation loop never restarts
  const targetRef = useRef(0);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // smooth turning: the angle glides toward the target
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setAngle((a) => {
        const d = targetRef.current - a;
        return Math.abs(d) < 0.001 ? targetRef.current : a + d * 0.09;
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // continuous automatic spin (pauses while the mouse is over it)
  useEffect(() => {
    if (n < 2 || paused) return;
    const CARDS_PER_SECOND = 0.15; // bigger = faster
    let raf = 0;
    let last = performance.now();
    const spin = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTarget((x) => x + dt * CARDS_PER_SECOND);
      raf = window.requestAnimationFrame(spin);
    };
    raf = window.requestAnimationFrame(spin);
    return () => window.cancelAnimationFrame(raf);
  }, [n, paused]);

  const rotateTo = (i: number) => {
    setTarget((t) => {
      const cur = ((Math.round(t) % n) + n) % n;
      let d = i - cur;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      return t + d;
    });
  };

  const toVideo = (item: Top): Video => {
    const known = videos.find((v) => v.youtubeId === item.youtubeId);
    return (
      known ?? {
        ...videoFromYoutubeId(item.youtubeId),
        title: item.title || "YouTube video",
      }
    );
  };

  const small = viewW < 640;
  const cardW = small ? 210 : 270;
  const cardH = Math.round((cardW * 9) / 16) + 118;
  const sceneH = cardH + 80;
  const rx = Math.max(50, Math.min(380, ((viewW - 48 - cardW) / 2) * 0.9));
  const step = n > 0 ? (Math.PI * 2) / n : 0;
  const front = n > 0 ? ((Math.round(angle) % n) + n) % n : 0;

  const statItems = [
    { label: "Rooms created", value: stats?.rooms },
    { label: "Videos queued", value: stats?.videos },
    { label: "Chat messages", value: stats?.messages },
    { label: "Poll votes", value: stats?.votes },
  ];

  return (
    <section
      id="community"
      className="mx-auto max-w-[1450px] scroll-mt-24 px-5 pb-20 lg:px-10"
    >
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
          Better together
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Community
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Live numbers from every watch party, and the videos people queue the most.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-[#111] p-5"
          >
            <p className="text-3xl font-black tabular-nums text-white">
              {item.value === undefined ? "–" : item.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-10 text-lg font-bold">
        {n === 4 ? "Top 4 most added" : "Most added videos"}
      </h3>

      {!loaded ? (
        <p className="text-sm text-zinc-500">Loading the community...</p>
      ) : top.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#111] py-12 text-center">
          <p className="text-3xl">🍿</p>
          <p className="mt-3 text-sm text-zinc-400">
            No videos have been added to a playlist yet. Add some in a room and
            they will show up here.
          </p>
        </div>
      ) : (
        <>
          <div
            className="wp-orbit-scene relative mx-auto w-full overflow-hidden"
            style={{ height: sceneH }}
            onMouseEnter={() => {
              setPaused(true);
              setTarget((t) => Math.round(t));
            }}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="wp-orbit-floor" />
            {featured.map((item, i) => {
              const theta = (i - angle) * step;
              const depth = Math.cos(theta);
              const x = Math.sin(theta) * rx;
              const k = (depth + 1) / 2;
              const scale = 0.62 + 0.38 * k;
              const lift = (1 - depth) * 26;
              const tilt = -Math.sin(theta) * 28;
              const isFront = i === front;
              const video = toVideo(item);
              return (
                <article
                  key={item.youtubeId}
                  onClick={() => {
                    if (!isFront) rotateTo(i);
                  }}
                  onMouseEnter={() => {
                    if (isFront) startPreview(item.youtubeId);
                  }}
                  onMouseLeave={stopPreview}
                  onClickCapture={(event) => {
                    if ((event.target as HTMLElement).closest("button")) stopPreview();
                  }}
                  className={`absolute left-1/2 top-1/2 overflow-hidden rounded-2xl border bg-[#111] ${
                    isFront
                      ? "border-red-500/60 shadow-2xl shadow-red-950/60"
                      : "cursor-pointer border-white/10"
                  }`}
                  style={{
                    width: cardW,
                    marginLeft: -cardW / 2,
                    marginTop: -cardH / 2 + 20,
                    transform: `translate3d(${x}px, ${-lift}px, 0) rotateY(${tilt}deg) scale(${scale})`,
                    opacity: 0.35 + 0.65 * k,
                    zIndex: Math.round((depth + 1) * 50),
                  }}
                >
                  <div className="relative aspect-video bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrl(item.youtubeId)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {isFront && previewLayer(item.youtubeId, item.title)}
                    <span className="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-[10px] font-black">
                      #{i + 1}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-bold">
                      {item.title || "Loading title..."}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Added {item.count} {item.count === 1 ? "time" : "times"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isFront) {
                            rotateTo(i);
                            return;
                          }
                          onWatch(video);
                        }}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold hover:bg-red-500"
                      >
                        ▶ Watch
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isFront) {
                            rotateTo(i);
                            return;
                          }
                          onAdd(video);
                        }}
                        className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                      >
                        + Playlist
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {n > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                onClick={() => setTarget((x) => x - 1)}
                aria-label="Previous video"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-lg hover:bg-white/10"
              >
                ‹
              </button>
              <div className="flex gap-2">
                {featured.map((item, i) => (
                  <button
                    key={item.youtubeId}
                    onClick={() => rotateTo(i)}
                    aria-label={`Show video ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === front ? "w-6 bg-red-500" : "w-2 bg-white/20"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setTarget((x) => x + 1)}
                aria-label="Next video"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-lg hover:bg-white/10"
              >
                ›
              </button>
            </div>
          )}

          {rest.length > 0 && (
            <>
              <h3 className="mb-4 mt-12 text-lg font-bold">More from the community</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((item, i) => {
                  const video = toVideo(item);
                  return (
                    <article
                      key={item.youtubeId}
                      onMouseEnter={() => startPreview(item.youtubeId)}
                      onMouseLeave={stopPreview}
                      onClickCapture={(event) => {
                    if ((event.target as HTMLElement).closest("button")) stopPreview();
                  }}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]"
                    >
                      <div className="relative aspect-video bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl(item.youtubeId)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {previewLayer(item.youtubeId, item.title)}
                        <span className="absolute left-3 top-3 rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-black">
                          #{i + 5}
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="truncate text-sm font-bold">
                          {item.title || "Loading title..."}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Added {item.count} {item.count === 1 ? "time" : "times"}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => onWatch(video)}
                            className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold hover:bg-red-500"
                          >
                            ▶ Watch
                          </button>
                          <button
                            onClick={() => onAdd(video)}
                            className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                          >
                            + Playlist
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

// wp-hero-trailer: muted trailers that shuffle on the homepage card
// To add more videos, put their 11-character IDs in this list.
const HERO_TRAILERS = [
  "vIZWLvcMS9c",
  "oqxAJKy0ii4",
  "XneHBxjMg_Y",
  "DHJO6VR6TYY",
  "PssKpzB0Ah0",
  "03u4xyj0TH4",
  "gpv7ayf_tyE",
];

type HeroPlayer = {
  loadVideoById: (id: string) => void;
  mute: () => void;
  playVideo: () => void;
  destroy: () => void;
};

function HeroTrailer({ active }: { active: boolean }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!active || !box) return;
    const holder: HTMLDivElement = box;
    let cancelled = false;
    let player: HeroPlayer | null = null;
    let current = Math.floor(Math.random() * HERO_TRAILERS.length);
    let timer = 0;
    let failures = 0;

    function arm() {
      window.clearTimeout(timer);
      timer = window.setTimeout(next, 20000);
    }

    function next() {
      if (cancelled || !player) return;
      let n = current;
      while (n === current && HERO_TRAILERS.length > 1) {
        n = Math.floor(Math.random() * HERO_TRAILERS.length);
      }
      current = n;
      player.loadVideoById(HERO_TRAILERS[current]);
      arm();
    }

    function create() {
      if (cancelled || !window.YT) return;
      const api = window.YT as unknown as {
        Player: new (el: HTMLElement, options: object) => HeroPlayer;
      };
      const mount = document.createElement("div");
      holder.appendChild(mount);
      player = new api.Player(mount, {
        videoId: HERO_TRAILERS[current],
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            player?.mute();
            player?.playVideo();
            arm();
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) {
              failures = 0;
              setPlaying(true);
            } else if (e.data === 0) {
              next();
            }
          },
          onError: () => {
            failures += 1;
            if (failures >= HERO_TRAILERS.length) {
              setPlaying(false);
              window.clearTimeout(timer);
              return;
            }
            next();
          },
        },
      });
    }

    if (window.YT?.Player) {
      create();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        create();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      player?.destroy();
      player = null;
      holder.innerHTML = "";
      setPlaying(false);
    };
  }, [active]);

  const visible = active && playing;
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          ref={boxRef}
          className="absolute left-1/2 top-0 h-full w-[134%] -translate-x-1/2"
        />
      </div>
      <div
        className={`pointer-events-none absolute inset-0 bg-black/45 transition-opacity duration-1000 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

// wp-fuzzy: typo-tolerant search (edit distance, no library)
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Lower score = better match. Infinity = no match.
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (!q) return 0;
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  if (t.replace(/ /g, "").includes(q.replace(/ /g, ""))) return 0;

  const words = t.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const token of q.split(/\s+/)) {
    if (words.some((w) => w.includes(token))) continue;
    const allowed = token.length <= 3 ? 0 : token.length <= 6 ? 1 : 2;
    if (allowed === 0) return Infinity;
    let best = Infinity;
    for (const w of words) {
      const d = Math.min(
        editDistance(token, w),
        editDistance(token, w.slice(0, token.length))
      );
      if (d < best) best = d;
    }
    if (best > allowed) return Infinity;
    total += best;
  }
  return total;
}

// wp-measure: latency and drift measurements. Open the app with ?debug=1 to see the panel.
const WP_MEASURE = {
  latency: [] as number[],
  driftBefore: [] as number[],
  driftAfter: [] as number[],
  corrections: 0,
  awaitingAfter: false,
  correctedAt: 0,
  rtt: [] as number[],
  rttPeers: new Set<string>(),
  pings: new Set<string>(),
  sendPing: null as (() => void) | null,
  takeControl: null as (() => void) | null,
  requestSync: null as (() => void) | null,
  forceDrift: null as (() => boolean) | null,
};

function wpSummarize(list: number[]) {
  const s = [...list].sort((a, b) => a - b);
  const at = (p: number) =>
    s.length
      ? s[Math.max(0, Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1))]
      : 0;
  return { n: s.length, p50: at(50), p95: at(95), max: s.length ? s[s.length - 1] : 0 };
}

function wpShare(list: number[], limit: number) {
  if (!list.length) return 0;
  return Math.round((list.filter((v) => v <= limit).length / list.length) * 100);
}

function wpSnapshot() {
  const m = WP_MEASURE;
  return {
    lat: wpSummarize(m.latency),
    latOk: wpShare(m.latency, 250),
    rtt: wpSummarize(m.rtt),
    rttOk: wpShare(m.rtt, 250),
    peers: m.rttPeers.size,
    before: wpSummarize(m.driftBefore),
    after: wpSummarize(m.driftAfter),
    afterOk: wpShare(m.driftAfter, 500),
    corrections: m.corrections,
  };
}
type WpSnapshot = ReturnType<typeof wpSnapshot>;

function wpReport(s: WpSnapshot, roomCode: string, people: number) {
  const f = (x: number) => x.toFixed(1);
  const row = (
    label: string,
    x: { n: number; p50: number; p95: number; max: number }
  ) => `${label}: n=${x.n}, p50=${f(x.p50)} ms, p95=${f(x.p95)} ms, max=${f(x.max)} ms`;
  return [
    "Watch Party measurements (all numbers measured in this browser)",
    `Time: ${new Date().toISOString()}`,
    `Room: ${roomCode || "none"}, people in room: ${people}`,
    `Browser: ${navigator.userAgent}`,
    row("Control latency (same computer clock)", s.lat) + `, within 250 ms: ${s.latOk}%`,
    row("App round trip / 2 (ping test)", s.rtt) +
      `, within 250 ms: ${s.rttOk}%, peers answering: ${s.peers}`,
    row("Drift when a sync message arrived", s.before),
    `Corrections applied: ${s.corrections}`,
    row("Drift at the next sync after a correction (about 2 s later)", s.after) +
      `, within 500 ms: ${s.afterOk}%`,
  ].join("\n");
}

function MeasurePanel({ roomCode, people }: { roomCode: string; people: number }) {
  const [visible, setVisible] = useState(false);
  const [snap, setSnap] = useState<WpSnapshot | null>(null);
  const [note, setNote] = useState("");
  const [forced, setForced] = useState(false);
  const shown = visible || forced;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(new URLSearchParams(window.location.search).get("debug") === "1");
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const id = window.setInterval(() => setSnap(wpSnapshot()), 500);
    return () => window.clearInterval(id);
  }, [shown]);

  if (!shown) {
    if (!roomCode) return null;
    return (
      <button
        onClick={() => setForced(true)}
        className="fixed bottom-5 left-5 z-[60] rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white shadow-2xl shadow-red-900/50 ring-2 ring-white/30 hover:bg-red-500"
      >
        Measure
      </button>
    );
  }

  function reset() {
    WP_MEASURE.latency.length = 0;
    WP_MEASURE.driftBefore.length = 0;
    WP_MEASURE.driftAfter.length = 0;
    WP_MEASURE.rtt.length = 0;
    WP_MEASURE.rttPeers.clear();
    WP_MEASURE.corrections = 0;
    WP_MEASURE.awaitingAfter = false;
    setNote("Numbers cleared.");
  }

  function runPing() {
    if (!WP_MEASURE.sendPing) {
      setNote("Join a room first.");
      return;
    }
    setNote("Sending 20 pings...");
    let sent = 0;
    const id = window.setInterval(() => {
      WP_MEASURE.sendPing?.();
      sent += 1;
      if (sent >= 20) {
        window.clearInterval(id);
        setNote("Ping test finished (20 pings sent).");
      }
    }, 300);
  }

  function forceDrift() {
    const ok = WP_MEASURE.forceDrift?.();
    setNote(
      ok
        ? "This window jumped 2 s ahead. The next sync message should correct it."
        : "The video must be PLAYING in this window. Press play, and use this button in the window that did NOT press play last."
    );
  }

  async function copy() {
    const text = wpReport(wpSnapshot(), roomCode, people);
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied. Paste it into your README or send it to me.");
    } catch {
      setNote(text);
    }
  }

  const btn =
    "rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 font-semibold hover:bg-white/15";

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[340px] rounded-2xl border border-white/15 bg-black/90 p-4 text-[11px] leading-5 text-zinc-200 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-red-400">
          Measurements
        </p>
        <span className="text-zinc-500">{people} in room</span>
      </div>
      {snap && (
        <div className="space-y-2">
          <div>
            <p className="font-bold text-white">Control latency (this window receiving)</p>
            <p>
              n={snap.lat.n} | p50 {snap.lat.p50.toFixed(0)} | p95 {snap.lat.p95.toFixed(0)} |
              max {snap.lat.max.toFixed(0)} ms
            </p>
            <p className={snap.lat.n && snap.lat.p95 <= 250 ? "text-green-400" : "text-zinc-400"}>
              within 250 ms: {snap.latOk}%
            </p>
          </div>
          <div>
            <p className="font-bold text-white">Ping test (round trip / 2)</p>
            <p>
              n={snap.rtt.n} | p50 {snap.rtt.p50.toFixed(1)} | p95 {snap.rtt.p95.toFixed(1)} |
              max {snap.rtt.max.toFixed(1)} ms | peers {snap.peers}
            </p>
          </div>
          <div>
            <p className="font-bold text-white">Drift</p>
            <p>
              before: n={snap.before.n} | p95 {snap.before.p95.toFixed(0)} | max{" "}
              {snap.before.max.toFixed(0)} ms
            </p>
            <p>
              corrections: {snap.corrections} | after: n={snap.after.n} | max{" "}
              {snap.after.max.toFixed(0)} ms | within 500 ms: {snap.afterOk}%
            </p>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={runPing} className={btn}>Ping test (20)</button>
        <button onClick={forceDrift} className={btn}>Force 2 s drift</button>
        <button onClick={() => void copy()} className={btn}>Copy results</button>
        <button onClick={reset} className={btn}>Reset</button>
        <button onClick={() => { setForced(false); setVisible(false); }} className={btn}>Hide</button>
      </div>
      {note && <p className="mt-2 whitespace-pre-wrap break-words text-zinc-400">{note}</p>}
    </div>
  );
}

// wp-pastelink: pull the 6-character room code out of a pasted invite link
function extractRoomCode(raw: string): string {
  const text = raw.trim();
  try {
    const fromLink = new URL(text).searchParams.get("room");
    if (fromLink) return fromLink.trim().toUpperCase();
  } catch {}
  const match = text.match(/[?&]room=([A-Za-z0-9]{6})/);
  if (match) return match[1].toUpperCase();
  return text.toUpperCase();
}

// wp-pill: a small connection health indicator (green / amber / red)
type PillKind = "checking" | "live" | "slow" | "offline";

function ConnectionPill({ roomCode }: { roomCode: string }) {
  const [state, setState] = useState<{ kind: PillKind; ms: number | null }>({
    kind: "checking",
    ms: null,
  });

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    let seenConnected = false;
    let lastKind: PillKind = "checking";

    function put(kind: PillKind, ms: number | null) {
      if (cancelled) return;
      lastKind = kind;
      setState({ kind, ms });
    }

    function socketUp() {
      return navigator.onLine && supabase.realtime.isConnected();
    }

    async function check() {
      if (document.visibilityState === "hidden") return;
      if (!socketUp()) {
        if (seenConnected) put("offline", null);
        return;
      }
      seenConnected = true;
      const t0 = performance.now();
      const { error } = await supabase
        .from("rooms")
        .select("code")
        .eq("code", roomCode)
        .limit(1);
      if (cancelled) return;
      if (error) {
        put("offline", null);
        return;
      }
      const ms = Math.round(performance.now() - t0);
      put(ms > 300 ? "slow" : "live", ms);
    }

    const first = window.setTimeout(() => void check(), 800);
    const slowTimer = window.setInterval(() => void check(), 5000);
    // react quickly when the connection drops or comes back
    const fastTimer = window.setInterval(() => {
      if (socketUp()) {
        seenConnected = true;
        if (lastKind === "offline") void check();
      } else if (seenConnected && lastKind !== "offline") {
        put("offline", null);
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(slowTimer);
      window.clearInterval(fastTimer);
    };
  }, [roomCode]);

  const dot = {
    checking: "bg-zinc-500",
    live: "bg-green-400",
    slow: "bg-amber-400",
    offline: "bg-red-500",
  }[state.kind];
  const label =
    state.kind === "live"
      ? `Live · ${state.ms} ms`
      : state.kind === "slow"
        ? `Slow · ${state.ms} ms`
        : state.kind === "offline"
          ? "Offline"
          : "Checking...";

  return (
    <span
      title="Round trip to the server, checked every 5 seconds. Green = healthy, amber = slow, red = offline."
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-zinc-300"
    >
      <span
        className={`h-2 w-2 rounded-full ${dot} ${state.kind === "live" ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}

// wp-chatplus: a different avatar color for each person
const AVATAR_COLORS = [
  "from-red-500 to-rose-800",
  "from-blue-500 to-indigo-800",
  "from-emerald-500 to-teal-800",
  "from-amber-400 to-orange-700",
  "from-fuchsia-500 to-purple-800",
  "from-cyan-400 to-sky-700",
  "from-lime-400 to-green-700",
  "from-pink-400 to-rose-600",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// wpNameTaken: look at who is in the room right now (Presence) without joining it
function wpNameTaken(code: string, name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = supabase.channel(`presence-${code}`, {
      config: { presence: { key: `probe-${Math.random().toString(36).slice(2)}` } },
    });
    let done = false;
    let timer = 0;
    const finish = (taken: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      void supabase.removeChannel(probe);
      resolve(taken);
    };
    timer = window.setTimeout(() => finish(false), 2500);
    probe
      .on("presence", { event: "sync" }, () => {
        const names = Object.keys(probe.presenceState()).map((k) => k.toLowerCase());
        finish(names.includes(name.toLowerCase()));
      })
      .subscribe();
  });
}

// wp-clean-preview: true when a YouTube embed says its video is playing
function wpEmbedPlaying(raw: unknown): boolean {
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!d || typeof d !== "object") return false;
    const m = d as { event?: string; info?: unknown };
    if (m.event === "onStateChange") return m.info === 1;
    if (m.event === "infoDelivery") {
      return (m.info as { playerState?: number } | undefined)?.playerState === 1;
    }
  } catch {}
  return false;
}

// wp-clickproof: previews ignore clicks
export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedVideo, setSelectedVideo] = useState<Video>(videos[0]);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [playlist, setPlaylist] = useState<Video[]>([videos[1], videos[2]]);

useEffect(() => {
  if (!roomCode) return;

  const channel = supabase
    .channel(`room-video-${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `code=eq.${roomCode}`,
      },
      (payload) => {
        console.log("ROOM UPDATE RECEIVED:", payload.new);
        const updatedRoom = payload.new as {
          current_video_id?: string | null;
        };

        const youtubeId = updatedRoom.current_video_id;

        if (!youtubeId) return;

        const existingVideo = videos.find(
          (video) => video.youtubeId === youtubeId
        );

        const nextVideo: Video = existingVideo ?? {
          id: `custom-${youtubeId}`,
          title: "Your YouTube selection",
          category: "Community",
          year: "YouTube",
          duration: "Video",
          description: "Added from your YouTube link.",
          color: "from-red-950 via-zinc-900 to-black",
          youtubeId,
        };

        setSelectedVideo(nextVideo);


        setRoomMessage("The room video has been updated!");
      }
    )
    .subscribe((status) => {
      console.log("Room video subscription:", status);
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}, [roomCode]);

  const [roomOpen, setRoomOpen] = useState(false);
  // wp-pages: the app has 3 views (Home, Watch room, Discover)
  const [page, setPage] = useState<"home" | "watch" | "discover">("home");
  // wp-preview: rest the cursor on a Discover card for about 0.7 s to see a muted preview
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const previewTimerRef = useRef(0);

  function startPreview(id: string) {
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewReady(false);
      setPreviewKey((k) => k + 1);
      setPreviewId(id);
    }, 60);
  }

  function stopPreview() {
    window.clearTimeout(previewTimerRef.current);
    setPreviewId(null);
    setPreviewReady(false);
  }

  useEffect(() => {
    if (!previewId) return;
    const t = window.setInterval(() => {
      setPreviewReady(false);
      setPreviewKey((k) => k + 1);
    }, 8500);
    return () => window.clearInterval(t);
  }, [previewId]);

  // wp-clean-preview: show the preview only once the video is really playing
  useEffect(() => {
    if (!previewId) return;
    const onMessage = (e: MessageEvent) => {
      if (!String(e.origin).includes("youtube")) return;
      if (wpEmbedPlaying(e.data)) setPreviewReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewId]);
  const [activeTab, setActiveTab] = useState("Chat");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ id: string; name: string; text: string; time: string }>
  >([]);
  const [reactions, setReactions] = useState<string[]>([]);
  const [pollOptions, setPollOptions] = useState<
    Array<{ label: string; votes: number }>
  >([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [pollMessage, setPollMessage] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>(["", ""]);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [addedBy, setAddedBy] = useState<Record<string, string>>({});
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const positionsRef = useRef<Map<string, number>>(new Map());
  const titleCacheRef = useRef<Map<string, string>>(new Map());
  const [playlistLink, setPlaylistLink] = useState("");
  const [playlistLinkMsg, setPlaylistLinkMsg] = useState("");
  const reorderLockRef = useRef(0);
  const playlistReloadRef = useRef<(() => void) | null>(null);
  const playlistPublishRef = useRef<(() => void) | null>(null);

  // Who is in the room (Supabase Presence)
  const [participants, setParticipants] = useState<
    Array<{ key: string; name: string; joinedAt?: string }>
  >([]);
  const [displayName, setDisplayName] = useState("Guest");
  const [nameInput, setNameInput] = useState("");
  // wp-rename: change your name while you are in a room
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameMsg, setRenameMsg] = useState("");

  // Make the guest name in the browser only (Next.js doesn't allow random values during render)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let name = "";
      try {
        name = sessionStorage.getItem("wp-name") || "";
      } catch {}
      if (!name) {
        name = `Guest ${Math.floor(100 + Math.random() * 900)}`;
        try {
          sessionStorage.setItem("wp-name", name);
        } catch {}
      }
      setDisplayName(name);
      if (!/^Guest \d+$/.test(name)) setNameInput(name);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase.channel(`presence-${roomCode}`, {
      config: { presence: { key: displayName } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setParticipants(
          Object.keys(state).map((key) => {
          const meta = (
            state[key] as unknown as Array<{ joinedAt?: string }>
          )[0];
          return { key, name: key, joinedAt: meta?.joinedAt ?? "" };
        })
        );
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key !== displayName) setRoomMessage(`${key} joined the room`);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key !== displayName) setRoomMessage(`${key} left the room`);
      })
      .subscribe(async (status) => {
        console.log("Presence subscription:", status);
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: displayName,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomCode, displayName]);

  // ---------- Synchronized YouTube player ----------
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const selectedIdRef = useRef(selectedVideo.youtubeId);
  const ignoreUntilRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastPollRef = useRef(0);
  const sendRef = useRef<
    ((action: "play" | "pause" | "sync", time: number, playing?: boolean) => void) | null
  >(null);
  const [isHost, setIsHost] = useState(false);
  const [hostName, setHostName] = useState("");
  const controllerRef = useRef(false);
  const reactionHandlerRef = useRef<((emoji: string, name: string) => void) | null>(null);
  const reactionPublishRef = useRef<((emoji: string, name: string) => void) | null>(null);
  const [driftMs, setDriftMs] = useState<number | null>(null);

  // A) Create the YouTube player once
  useEffect(() => {
    let cancelled = false;
    const box = playerBoxRef.current;

    const handleState = (state: number) => {
      if (Date.now() < ignoreUntilRef.current) return;
      const p = playerRef.current;
      if (!p) return;
      if (state === 1) sendRef.current?.("play", p.getCurrentTime());
      else if (state === 2) sendRef.current?.("pause", p.getCurrentTime());
    };

    const create = () => {
      if (cancelled || !box || !window.YT) return;
      const mount = document.createElement("div");
      box.appendChild(mount);
      playerRef.current = new window.YT.Player(mount, {
        videoId: selectedIdRef.current,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
          },
          onStateChange: (e: { data: number }) => handleState(e.data),
        },
      });
    };

    if (window.YT?.Player) {
      create();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        create();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      playerReadyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
      if (box) box.innerHTML = "";
    };
  }, []);

  // B) When the selected video changes, load it into the player
  useEffect(() => {
    selectedIdRef.current = selectedVideo.youtubeId;
    const p = playerRef.current;
    if (!p || !playerReadyRef.current) return;
    if (p.getVideoData?.()?.video_id !== selectedVideo.youtubeId) {
      ignoreUntilRef.current = Date.now() + 1500;
      lastTimeRef.current = 0;
      lastPollRef.current = Date.now();
      p.cueVideoById(selectedVideo.youtubeId);
    }
  }, [selectedVideo.youtubeId]);

  // C) Am I the host?
  useEffect(() => {
    if (!roomCode) return;
    supabase
      .from("rooms")
      .select("host_name")
      .eq("code", roomCode)
      .maybeSingle()
      .then(({ data }) => {
        setHostName(data?.host_name ?? "");
        const host = data?.host_name === displayName;
        setIsHost(host);
        if (host) controllerRef.current = true;
      });
  }, [roomCode, displayName]);

  // wp-host: follow host changes (transfer or takeover) in every browser
  useEffect(() => {
    if (!roomCode) return;
    let last = "";
    const applyHost = (name: string) => {
      if (name === last) return;
      const wasMine = last === displayName;
      last = name;
      const mine = name === displayName;
      setHostName(name);
      setIsHost(mine);
      if (mine) controllerRef.current = true;
      if (wasMine && !mine) controllerRef.current = false;
    };
    const channel = supabase
      .channel(`host-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          const h = (payload.new as { host_name?: string | null }).host_name;
          if (h) applyHost(h);
        }
      )
      .subscribe((status) => {
        console.log("Host subscription:", status);
      });
    const poll = window.setInterval(() => {
      supabase
        .from("rooms")
        .select("host_name")
        .eq("code", roomCode)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.host_name) applyHost(data.host_name);
        });
    }, 3000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [roomCode, displayName]);

  // wp-host: if the host leaves, the earliest-joined person takes over
  useEffect(() => {
    console.log("HOST CHECK:", { me: displayName, host: hostName, here: participants.map((x) => x.key) });
    if (!roomCode || !hostName) return;
    if (participants.length === 0) return;
    if (!participants.some((x) => x.key === displayName)) return;
    if (participants.some((x) => x.key === hostName)) return;

    const successor = participants
      .filter((x) => x.key !== hostName)
      .sort(
        (a, b) =>
          (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "") ||
          a.key.localeCompare(b.key)
      )[0];
    if (!successor || successor.key !== displayName) return;

    const oldHost = hostName;
    console.log("HOST TAKEOVER: scheduled in 6 s, old host was", oldHost);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("rooms")
        .update({ host_name: displayName })
        .eq("code", roomCode)
        .eq("host_name", oldHost)
        .select("code");
      if (error) {
        console.warn("Host takeover error:", error.message, error.code);
        return;
      }
      if (data && data.length > 0) {
        setHostName(displayName);
        setIsHost(true);
        controllerRef.current = true;
        setRoomMessage(`${oldHost} left, so you are now the host.`);
      }
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [roomCode, displayName, hostName, participants]);

  // wp-reconnect: detect a dropped connection and catch up with the room
  const [connection, setConnection] = useState<"ok" | "reconnecting">("ok");

  useEffect(() => {
    if (!roomCode) return;
    const code = roomCode;
    let seenConnected = false;
    let wasDown = false;
    let hiddenAt = 0;

    function resync(reason: string) {
      wasDown = false;
      console.log("RECONNECT: resyncing room", code, "-", reason);
      setConnection("ok");
      setRoomMessage("Back online - catching up with the room...");
      // Leaving and re-entering the room makes every channel re-subscribe
      // and reload its data (video position, chat, poll, playlist, host).
      setRoomCode("");
      window.setTimeout(() => setRoomCode(code), 200);
    }

    function markDown(reason: string) {
      if (wasDown) return;
      wasDown = true;
      console.log("RECONNECT: connection lost -", reason);
      setConnection("reconnecting");
    }

    const timer = window.setInterval(() => {
      const connected = supabase.realtime.isConnected();
      if (connected) seenConnected = true;
      if (!connected && seenConnected) markDown("realtime socket closed");
      if (connected && wasDown && navigator.onLine) resync("connection is back");
    }, 1000);

    const onOffline = () => markDown("browser went offline");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 120000) {
        hiddenAt = 0;
        resync("tab was in the background for a while");
      } else {
        hiddenAt = 0;
      }
    };
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomCode]);

  // wp-measure: helpers for the measurement panel
  const displayNameRef = useRef(displayName);
  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  useEffect(() => {
    WP_MEASURE.forceDrift = () => {
      const p = playerRef.current;
      if (!p || !playerReadyRef.current) return false;
      const state = (p as unknown as { getPlayerState?: () => number }).getPlayerState?.();
      if (state !== 1) return false;
      controllerRef.current = false;
      WP_MEASURE.takeControl?.();
      ignoreUntilRef.current = Date.now() + 1500;
      const before = p.getCurrentTime();
      p.seekTo(before + 2, true);
      window.setTimeout(() => WP_MEASURE.requestSync?.(), 400);
      console.log("FORCE DRIFT: jumped from", before.toFixed(2), "to", (before + 2).toFixed(2));
      return true;
    };
    return () => {
      WP_MEASURE.forceDrift = null;
    };
  }, []);

  // wp-chatplus: keep the newest chat message in view (in every window)
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatSeenRef = useRef({ count: 0, tab: "" });
  const chatStickRef = useRef(true);

  useEffect(() => {
    const el = chatScrollRef.current;
    const seen = chatSeenRef.current;
    const tabChanged = seen.tab !== activeTab;
    const added = messages.length - seen.count;
    seen.tab = activeTab;
    seen.count = messages.length;
    if (!el || activeTab !== "Chat") return;
    if (tabChanged) {
      chatStickRef.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (added > 0 && (added > 3 || chatStickRef.current)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, activeTab]);

  // D) Broadcast play/pause/seek + apply what others send
  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase.channel(`sync-${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    sendRef.current = (action, time, playing) => {
      if (action !== "sync") controllerRef.current = true;
      const message: SyncMessage = { action, time, playing, sentAt: Date.now() };
      void channel.send({ type: "broadcast", event: "control", payload: message });
      if (action !== "sync") {
        void supabase
          .from("rooms")
          .update({
            is_playing: action === "play",
            current_time_seconds: time,
            updated_at: new Date().toISOString(),
          })
          .eq("code", roomCode);
      }
    };

    const applyRemote = (msg: SyncMessage) => {
      const p = playerRef.current;
      if (!p || !playerReadyRef.current) return;
      const current = p.getCurrentTime();
      const isPlaying = p.getPlayerState() === 1;

      if (msg.action === "sync") {
        const drift = current - msg.time;
        console.log("DRIFT (seconds):", drift.toFixed(3));
        const driftAbsMs = Math.abs(drift) * 1000;
        if (WP_MEASURE.awaitingAfter) {
          if (Date.now() - WP_MEASURE.correctedAt >= 1000) {
            WP_MEASURE.driftAfter.push(driftAbsMs);
            WP_MEASURE.awaitingAfter = false;
          }
        } else {
          WP_MEASURE.driftBefore.push(driftAbsMs);
        }
        setDriftMs(Math.round(Math.abs(drift) * 1000));
        const shouldPlay = !!msg.playing;
        if (shouldPlay !== isPlaying || Math.abs(drift) > 0.5) {
          WP_MEASURE.corrections += 1;
          WP_MEASURE.awaitingAfter = true;
          WP_MEASURE.correctedAt = Date.now();
          ignoreUntilRef.current = Date.now() + 1000;
          if (Math.abs(drift) > 0.5) p.seekTo(msg.time, true);
          if (shouldPlay && !isPlaying) p.playVideo();
          if (!shouldPlay && isPlaying) p.pauseVideo();
        }
        return;
      }

      controllerRef.current = false;
      const latencyMs = Date.now() - msg.sentAt;
      console.log("SYNC latency ms (same-computer test only):", latencyMs);
      WP_MEASURE.latency.push(latencyMs);
      ignoreUntilRef.current = Date.now() + 1000;
      if (Math.abs(current - msg.time) > 0.3) p.seekTo(msg.time, true);
      if (msg.action === "play") p.playVideo();
      else p.pauseVideo();
    };

    channel
      .on("broadcast", { event: "control" }, ({ payload }) =>
        applyRemote(payload as SyncMessage)
      )
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const r = payload as { emoji: string; name: string };
        console.log("REACTION RECEIVED:", r);
        reactionHandlerRef.current?.(r.emoji, r.name);
      })
      .on("broadcast", { event: "wp-sync-request" }, () => {
        const p = playerRef.current;
        if (!p || !playerReadyRef.current) return;
        console.log("SYNC REQUEST received - replying with my position");
        sendRef.current?.("sync", p.getCurrentTime(), p.getPlayerState() === 1);
      })
      .on("broadcast", { event: "wp-take-control" }, () => {
        // wp-take-control: another window is testing drift, so we send the real position
        controllerRef.current = true;
      })
      .on("broadcast", { event: "wp-ping" }, ({ payload }) => {
        const m = payload as { id: string; t0: number };
        void channel.send({
          type: "broadcast",
          event: "wp-pong",
          payload: { id: m.id, t0: m.t0, from: displayNameRef.current },
        });
      })
      .on("broadcast", { event: "wp-pong" }, ({ payload }) => {
        const m = payload as { id: string; t0: number; from: string };
        if (!WP_MEASURE.pings.has(m.id)) return;
        WP_MEASURE.rtt.push((performance.now() - m.t0) / 2);
        WP_MEASURE.rttPeers.add(m.from);
      })
      .on("broadcast", { event: "playlist-changed" }, () => {
        console.log("PLAYLIST CHANGED message received");
        playlistReloadRef.current?.();
      })
      .subscribe((status) => console.log("Sync subscription:", status));
    WP_MEASURE.requestSync = () => {
      void channel.send({ type: "broadcast", event: "wp-sync-request", payload: {} });
    };
    WP_MEASURE.takeControl = () => {
      void channel.send({ type: "broadcast", event: "wp-take-control", payload: {} });
    };
    WP_MEASURE.sendPing = () => {
      const id = Math.random().toString(36).slice(2);
      WP_MEASURE.pings.add(id);
      void channel.send({
        type: "broadcast",
        event: "wp-ping",
        payload: { id, t0: performance.now() },
      });
    };
    playlistPublishRef.current = () => {
      void channel.send({ type: "broadcast", event: "playlist-changed", payload: {} });
    };
    reactionPublishRef.current = (emoji, name) => {
      void channel
        .send({
          type: "broadcast",
          event: "reaction",
          payload: { emoji, name },
        })
        .then((result) => console.log("REACTION send result:", result));
    };

    // Detect seeking by watching for sudden jumps in the time
    lastPollRef.current = Date.now();
    const pollTimer = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !playerReadyRef.current) return;
      const now = Date.now();
      const state = p.getPlayerState();
      const current = p.getCurrentTime();
      const expected =
        lastTimeRef.current +
        (state === 1 ? (now - lastPollRef.current) / 1000 : 0);
      if (now > ignoreUntilRef.current && Math.abs(current - expected) > 1.5) {
        sendRef.current?.(state === 1 ? "play" : "pause", current);
      }
      lastTimeRef.current = current;
      lastPollRef.current = now;
    }, 500);

    // Late joiners: start from the saved room state
    let tries = 0;
    const initTimer = window.setInterval(async () => {
      tries += 1;
      if (tries > 40) window.clearInterval(initTimer);
      if (!playerReadyRef.current) return;
      window.clearInterval(initTimer);
      const { data } = await supabase
        .from("rooms")
        .select("current_video_id, is_playing, current_time_seconds, updated_at")
        .eq("code", roomCode)
        .maybeSingle();
      const p = playerRef.current;
      if (!data || !p) return;
      ignoreUntilRef.current = Date.now() + 1500;
      if (data.current_video_id && p.getVideoData?.()?.video_id !== data.current_video_id) {
        p.cueVideoById(data.current_video_id);
      }
      let t = data.current_time_seconds ?? 0;
      if (data.is_playing && data.updated_at) {
        t += Math.max(0, (Date.now() - new Date(data.updated_at).getTime()) / 1000);
      }
      p.seekTo(t, true);
      if (data.is_playing) p.playVideo();
    }, 300);

    return () => {
      window.clearInterval(pollTimer);
      window.clearInterval(initTimer);
      sendRef.current = null;
      reactionPublishRef.current = null;
      playlistPublishRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // E) The host sends the real position every 2 seconds (drift correction)
  useEffect(() => {
    if (!roomCode) return;
    const timer = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !playerReadyRef.current) return;
      if (controllerRef.current)
        sendRef.current?.("sync", p.getCurrentTime(), p.getPlayerState() === 1);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [roomCode]);

  // ---------- Floating reactions (like Google Meet) ----------
  const [floating, setFloating] = useState<
    Array<{ id: number; emoji: string; name: string; left: number; variant: number }>
  >([]);
  const floatIdRef = useRef(0);

  const spawnFloating = useCallback((emoji: string, name: string) => {
    floatIdRef.current += 1;
    const id = floatIdRef.current;
    const item = {
      id,
      emoji,
      name,
      left: 5 + Math.random() * 80,
      variant: Math.floor(Math.random() * 3),
    };
    setFloating((current) => [...current.slice(-39), item]);
    window.setTimeout(() => {
      setFloating((current) => current.filter((f) => f.id !== id));
    }, 6200);
  }, []);

  useEffect(() => {
    reactionHandlerRef.current = spawnFloating;
    return () => {
      reactionHandlerRef.current = null;
    };
  }, [spawnFloating]);

  const sendReaction = (emoji: string) => {
    setReactions((current) => [...current, emoji]);
    spawnFloating(emoji, "You");
    console.log("REACTION SENT:", emoji, "publisher ready:", Boolean(reactionPublishRef.current));
    reactionPublishRef.current?.(emoji, displayName);
  };

  // Poll: host-created questions, shared votes (loaded + live)
  useEffect(() => {
    if (!roomCode) return;

    type PollRow = { id: string; question: string; options: unknown };
    type VoteRow = {
      voter_name: string;
      option_index: number;
      poll_id: string | null;
    };

    const defaultLabels: string[] = [];
    const defaultQuestion = "";
    let currentId: string | null = null;
    let labels = defaultLabels;
    const votes = new Map<string, number>();

    const render = () => {
      const counts = labels.map(() => 0);
      votes.forEach((option) => {
        if (counts[option] !== undefined) counts[option] += 1;
      });
      setPollOptions(labels.map((label, i) => ({ label, votes: counts[i] })));
      const mine = votes.get(displayName);
      setMyVote(mine === undefined ? null : mine);
    };

    const toLabels = (raw: unknown): string[] => {
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(arr) ? arr.map(String) : defaultLabels;
      } catch {
        return defaultLabels;
      }
    };

    const loadVotes = () => {
      const base = supabase
        .from("poll_votes")
        .select("voter_name, option_index, poll_id")
        .eq("room_code", roomCode);
      const request = currentId
        ? base.eq("poll_id", currentId)
        : base.is("poll_id", null);
      request.then(({ data, error }) => {
        if (error) {
          console.warn("Load votes error:", error.message);
          setPollMessage(`Could not load votes: ${error.message}`);
          return;
        }
        ((data ?? []) as VoteRow[]).forEach((r) =>
          votes.set(r.voter_name, r.option_index)
        );
        render();
      });
    };

    const applyPoll = (id: string | null, question: string, newLabels: string[]) => {
      currentId = id;
      labels = newLabels;
      votes.clear();
      setActivePollId(id);
      setPollQuestion(question);
      setPollMessage("");
      render();
      loadVotes();
    };

    supabase
      .from("polls")
      .select("id, question, options")
      .eq("room_code", roomCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Load poll error:", error.message);
          setPollMessage(`Could not load poll: ${error.message}`);
          applyPoll(null, defaultQuestion, defaultLabels);
          return;
        }
        const row = data as PollRow | null;
        if (row) applyPoll(row.id, row.question, toLabels(row.options));
        else applyPoll(null, defaultQuestion, defaultLabels);
      });

    const channel = supabase
      .channel(`poll-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "polls",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new as PollRow;
          applyPoll(row.id, row.question, toLabels(row.options));
          setPollMessage("The host started a new poll!");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_votes",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new as VoteRow;
          if ((row.poll_id ?? null) !== currentId) return;
          votes.set(row.voter_name, row.option_index);
          render();
        }
      )
      .subscribe((status) => console.log("Poll subscription:", status));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomCode, displayName]);

  // Shared playlist (loaded from Supabase + live updates)
  useEffect(() => {
    if (!roomCode) return;

    type Row = {
      youtube_id: string;
      title: string | null;
      position: number | null;
    };

    const toVideo = (row: Row): Video => {
      const known = videos.find((v) => v.youtubeId === row.youtube_id);
      if (known) return known;
      const cached = titleCacheRef.current.get(row.youtube_id);
      const saved =
        row.title && row.title !== "Your YouTube selection" ? row.title : "";
      return {
        ...videoFromYoutubeId(row.youtube_id),
        title: cached || saved || "Loading title...",
      };
    };

    const load = async () => {
      const { data, error } = await supabase
        .from("playlist_items")
        .select("youtube_id, title, position, added_by")
        .eq("room_code", roomCode)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Load playlist error:", error.message);
        setRoomMessage(`Could not load playlist: ${error.message}`);
        return;
      }
      if (Date.now() < reorderLockRef.current) return;
      const rows = (data ?? []) as Row[];
      setAddedBy(
        Object.fromEntries(
          ((data ?? []) as unknown as Array<{ youtube_id: string; added_by?: string | null }>).map(
            (r) => [r.youtube_id, r.added_by ?? ""]
          )
        )
      );
      positionsRef.current = new Map(
        rows
          .filter((r) => r.position !== null)
          .map((r) => [r.youtube_id, r.position as number])
      );
      setPlaylist(rows.map(toVideo));

      rows.forEach((row) => {
        if (videos.some((v) => v.youtubeId === row.youtube_id)) return;
        const needsTitle = !row.title || row.title === "Your YouTube selection";
        if (!needsTitle || titleCacheRef.current.has(row.youtube_id)) return;
        titleCacheRef.current.set(row.youtube_id, "");
        void fetchYoutubeTitle(row.youtube_id).then(async (title) => {
          titleCacheRef.current.set(row.youtube_id, title || "YouTube video");
          if (title) {
            await supabase
              .from("playlist_items")
              .update({ title })
              .eq("room_code", roomCode)
              .eq("youtube_id", row.youtube_id);
          }
          void load();
        });
      });
    };

    void load();
    playlistReloadRef.current = () => void load();
    const poll = window.setInterval(() => void load(), 3000);

    const channel = supabase
      .channel(`playlist-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "playlist_items",
          filter: `room_code=eq.${roomCode}`,
        },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "playlist_items" },
        () => void load()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "playlist_items",
          filter: `room_code=eq.${roomCode}`,
        },
        () => void load()
      )
      .subscribe((status) => {
        console.log("Playlist subscription:", status);
        // Also re-load after a reconnect, so nothing is missed
        if (status === "SUBSCRIBED") void load();
      });

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(poll);
      playlistReloadRef.current = null;
    };
  }, [roomCode]);

  // Give a custom YouTube video its real title
  useEffect(() => {
    if (selectedVideo.title !== "Your YouTube selection") return;
    let cancelled = false;
    const id = selectedVideo.youtubeId;
    void fetchYoutubeTitle(id).then((title) => {
      if (cancelled || !title) return;
      setSelectedVideo((cur) =>
        cur.youtubeId === id ? { ...cur, title } : cur
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selectedVideo.title, selectedVideo.youtubeId]);

  // Backup: re-check the room video every 2 seconds
  useEffect(() => {
    if (!roomCode) return;
    const timer = window.setInterval(async () => {
      const { data } = await supabase
        .from("rooms")
        .select("current_video_id")
        .eq("code", roomCode)
        .maybeSingle();
      const id = data?.current_video_id;
      if (id) {
        setSelectedVideo((cur) =>
          cur.youtubeId === id ? cur : videoFromYoutubeId(id)
        );
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [roomCode]);


  // wp-autojoin: an invite link (?room=CODE) joins the room by itself
  const [autoJoin, setAutoJoin] = useState(false);

  useEffect(() => {
    if (!autoJoin || roomOpen) return;
    if (!/^[A-Z0-9]{6}$/.test(roomCodeInput)) return;
    const timer = window.setTimeout(() => {
      setAutoJoin(false);
      void joinRoom();
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, roomCodeInput, roomOpen]);

  // Read ?room=CODE from an invite link
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("room");
    if (!code) return;
    const timer = window.setTimeout(
      () => {
        setRoomCodeInput(code.toUpperCase());
        setAutoJoin(true);
      },
      0
    );
    return () => window.clearTimeout(timer);
  }, []);

  // Chat: load history + listen for new messages
  useEffect(() => {
    if (!roomCode) return;

    type Row = {
      id: string | number;
      sender_name: string | null;
      content: string;
      created_at?: string | null;
    };

    const toMessage = (row: Row) => ({
      id: String(row.id),
      name: row.sender_name || "Guest",
      text: row.content,
      time: row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    });

    // Adds messages but skips any id we already have (no duplicates)
    const addMessages = (incoming: Row[]) => {
      setMessages((current) => {
        const seen = new Set(current.map((m) => m.id));
        const fresh = incoming
          .map(toMessage)
          .filter((m) => !seen.has(m.id));
        return fresh.length ? [...current, ...fresh] : current;
      });
    };

    supabase
      .from("messages")
      .select("*")
      .eq("room_code", roomCode)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          console.warn("Load messages error:", error.message, error.code, error.details);
          setRoomMessage(`Could not load chat: ${error.message}`);
          return;
        }
        setMessages(((data ?? []) as Row[]).map(toMessage));
      });

    const channel = supabase
      .channel(`room-chat-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => addMessages([payload.new as Row])
      )
      .subscribe((status) => {
        console.log("Chat subscription:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomCode]);


  const filteredVideos = useMemo(() => {
    const search = query.trim();

    const scored = videos
      .map((video, index) => ({
        video,
        index,
        score: !search
          ? 0
          : Math.min(
              fuzzyScore(search, video.title),
              fuzzyScore(search, video.category) + 0.25,
              fuzzyScore(search, video.description) + 0.5
            ),
      }))
      .filter(
        (item) =>
          (category === "All" || item.video.category === category) &&
          Number.isFinite(item.score)
      );

    if (search) scored.sort((a, b) => a.score - b.score || a.index - b.index);
    return scored.map((item) => item.video);
  }, [query, category]);

// wp-host: the current host hands the room to someone else
async function makeHost(name: string) {
  if (!roomCode || !isHost || name === displayName) return;
  const { data, error } = await supabase
    .from("rooms")
    .update({ host_name: name })
    .eq("code", roomCode)
    .eq("host_name", displayName)
    .select("code");
  if (error) {
    console.warn("Make host error:", error.message, error.code, error.details);
    setRoomMessage(`Could not change host: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    setRoomMessage("Host was not changed (you may no longer be the host).");
    return;
  }
  setHostName(name);
  setIsHost(false);
  controllerRef.current = false;
  setRoomMessage(`${name} is now the host.`);
}

// wp-leave: leave the room and go back to the Home page
function leaveRoom() {
  controllerRef.current = false;
  ignoreUntilRef.current = Date.now() + 1500;
  playerRef.current?.pauseVideo();
  setRoomCode("");
  setRoomCodeInput("");
  setRoomOpen(false);
  setMessages([]);
  setPlaylist([]);
  setPollOptions([]);
  setPollQuestion("");
  setActivePollId(null);
  setMyVote(null);
  setPollMessage("");
  setShowPollForm(false);
  setParticipants([]);
  setHostName("");
  setIsHost(false);
  setDriftMs(null);
  setConnection("ok");
  setPage("home");
  window.scrollTo({ top: 0 });
  setRoomMessage("You left the room.");
}

// wp-rename: change your name while you are in a room
async function renameSelf() {
  const next = cleanName(renameInput);
  if (!next) {
    setRenameMsg("Type a name first.");
    return;
  }
  if (next === displayName) {
    setRenameMsg("That is already your name.");
    return;
  }
  const lower = next.toLowerCase();
  const takenByOther =
    participants.some((x) => x.key !== displayName && x.key.toLowerCase() === lower) ||
    (hostName !== displayName && hostName.toLowerCase() === lower);
  if (takenByOther) {
    setRenameMsg(`The name "${next}" is already taken in this room. Please choose something else.`);
    return;
  }
  if (isHost) {
    const { data, error } = await supabase
      .from("rooms")
      .update({ host_name: next })
      .eq("code", roomCode)
      .eq("host_name", displayName)
      .select("code");
    if (error || !data || data.length === 0) {
      setRenameMsg("Could not change your name right now. Please try again.");
      return;
    }
    setHostName(next);
  }
  setDisplayName(next);
  setNameInput(next);
  try {
    sessionStorage.setItem("wp-name", next);
  } catch {}
  setRenaming(false);
  setRenameInput("");
  setRenameMsg("");
  setRoomMessage(`You are now ${next}.`);
}

async function createRoom() {
  setRoomMessage("Creating your room...");
  const newHostName = cleanName(nameInput) || "Host";

  // 1. Generate the room code FIRST
  const code = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  console.log("Generated room code:", code);

  try {
    // 2. Save the room in Supabase
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        code,
        host_name: newHostName,
        current_video_id: selectedVideo.youtubeId,
        is_playing: false,
        current_time_seconds: 0,
      })
      .select("code")
      .single();

    console.log("Room insertion result:", { data, error });

    // 3. Handle database errors
    if (error) {
      console.error("Create room error:", error);
      setRoomMessage(`Supabase error: ${error.message}`);
      return;
    }

    // 4. Update the website after saving successfully
    setRoomCode(data.code);
    setRoomCodeInput(data.code);
    setRoomOpen(true);
    setPage("watch");
    window.scrollTo({ top: 0 });
    setRoomMessage("Your room is saved! Invite your friends.");
    setDisplayName(newHostName);
    try {
      sessionStorage.setItem("wp-name", newHostName);
    } catch {}
  } catch (err) {
    console.error("Unexpected room creation error:", err);
    setRoomMessage("Something went wrong while creating the room.");
  }
}

async function joinRoom(codeOverride?: string) {
  const code = extractRoomCode(codeOverride ?? roomCodeInput);

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    setRoomMessage("Enter a valid 6-character room code.");
    return;
  }

  setRoomMessage("Looking for your room...");

  const { data, error } = await supabase
    .from("rooms")
    .select(
      "code, host_name, current_video_id, is_playing, current_time_seconds"
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("Join room error:", error);
    setRoomMessage(`Could not join room: ${error.message}`);
    return;
  }

  if (!data) {
    setRoomMessage("Room not found. Check the code and try again.");
    return;
  }

  const typedName = cleanName(nameInput);
  const finalName = typedName || displayName;
  if (!typedName && /^Guest \d+$/.test(displayName)) {
    setRoomMessage("Type your name in the name box first, then join.");
    return;
  }
  const roomHost = String(data.host_name ?? "");
  if (
    finalName.toLowerCase() === roomHost.toLowerCase() &&
    finalName !== displayName
  ) {
    setRoomMessage("That name is already used by the host. Please pick another name.");
    return;
  }
  setRoomMessage("Checking your name...");
  if (finalName !== displayName && (await wpNameTaken(data.code, finalName))) {
    setRoomMessage(
      `The name "${finalName}" is already taken in this room. Please choose something else.`
    );
    return;
  }
  setDisplayName(finalName);
  try {
    sessionStorage.setItem("wp-name", finalName);
  } catch {}

  if (data.current_video_id) {
    setSelectedVideo(videoFromYoutubeId(data.current_video_id));
  }

  setRoomCode(data.code);
  setRoomCodeInput(data.code);
  setRoomOpen(true);
    setPage("watch");
    window.scrollTo({ top: 0 });
  setRoomMessage(`Joined room ${data.code}! Invite your friends.`);
}


async function addYoutubeVideo() {
  const input = youtubeInput.trim();
  let youtubeId = input;

  try {
    if (input.includes("youtube.com") || input.includes("youtu.be")) {
      const url = new URL(input);

      youtubeId = url.hostname.includes("youtu.be")
        ? url.pathname.slice(1)
        : url.searchParams.get("v") ||
          url.pathname.split("/").pop() ||
          "";
    }
  } catch {
    setRoomMessage("That link doesn't look valid. Try a YouTube video URL.");
    return;
  }

  youtubeId = youtubeId.split(/[?&#/]/)[0];

  if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    setRoomMessage(
      "Enter a valid YouTube video link or 11-character video ID."
    );
    return;
  }

  if (!roomCode) {
    setRoomMessage("Please create or join a room first.");
    return;
  }

  setRoomMessage("Syncing video with your room...");

  const { data, error } = await supabase
    .from("rooms")
    .update({
      current_video_id: youtubeId,
      is_playing: false,
      current_time_seconds: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("code", roomCode)
    .select("code")
    .maybeSingle();

  if (error) {
    console.warn("Video sync error:", error);
    setRoomMessage(`Video sync failed: ${error.message}`);
    return;
  }

  if (!data) {
    setRoomMessage(
      "Room was not updated. Check your room code and Supabase permissions."
    );
    return;
  }

  const customVideo: Video = {
    id: `custom-${youtubeId}`,
    title: "Your YouTube selection",
    category: "Community",
    year: "YouTube",
    duration: "Video",
    description: "Added from your YouTube link.",
    color: "from-red-950 via-zinc-900 to-black",
    youtubeId,
  };

  setSelectedVideo(customVideo);

  void addToPlaylist(customVideo);

  setYoutubeInput("");
  setShowYoutubeInput(false);
  setRoomMessage("Video saved! Updating everyone in the room...");
}


  async function selectVideo(video: Video) {
  setSelectedVideo(video);
  if (!roomCode) return;

  const { error } = await supabase
    .from("rooms")
    .update({
      current_video_id: video.youtubeId,
      is_playing: false,
      current_time_seconds: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("code", roomCode);

  if (error) {
    console.warn("Video sync error:", error);
    setRoomMessage(`Video sync failed: ${error.message}`);
  }
}

  async function addToPlaylist(video: Video) {
    // Show it right away on this screen
    setAddedBy((m) => ({ ...m, [video.youtubeId]: m[video.youtubeId] ?? displayName }));
    setPlaylist((current) =>
      current.some((item) => item.youtubeId === video.youtubeId)
        ? current
        : [...current, video]
    );
    if (!roomCode) return;

    const { error } = await supabase.from("playlist_items").upsert(
      {
        room_code: roomCode,
        youtube_id: video.youtubeId,
        title: video.title,
        added_by: displayName,
      },
      { onConflict: "room_code,youtube_id", ignoreDuplicates: true }
    );

    if (error) {
      console.warn("Add to playlist failed:", error.message, error.code);
      setRoomMessage(`Playlist error: ${error.message}`);
    }
  }

  async function removeFromPlaylist(video: Video) {
    setPlaylist((current) =>
      current.filter((item) => item.youtubeId !== video.youtubeId)
    );
    if (!roomCode) return;

    const { error } = await supabase
      .from("playlist_items")
      .delete()
      .eq("room_code", roomCode)
      .eq("youtube_id", video.youtubeId);

    if (error) {
      console.warn("Remove from playlist failed:", error.message, error.code);
      setRoomMessage(`Playlist error: ${error.message}`);
    }
  }

  async function movePlaylistItem(from: number, to: number) {
    if (from === to) return;
    const next = [...playlist];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPlaylist(next);
    if (!roomCode) return;

    console.log("REORDER start:", from, "->", to, next.map((v) => v.title));

    // Pause the 3-second refresh so it cannot undo the move while we save
    reorderLockRef.current = Date.now() + 5000;

    const results = await Promise.all(
      next.map((video, i) =>
        supabase
          .from("playlist_items")
          .update({ position: i })
          .eq("room_code", roomCode)
          .eq("youtube_id", video.youtubeId)
          .select("youtube_id")
      )
    );

    const failed = results.find((r) => r.error);
    if (failed && failed.error) {
      console.warn("Reorder failed:", failed.error.message, failed.error.code, failed.error.details);
      setRoomMessage(`Reorder failed: ${failed.error.message}`);
      reorderLockRef.current = 0;
      return;
    }

    const saved = results.filter((r) => r.data && r.data.length > 0).length;
    console.log("REORDER saved rows:", saved, "of", next.length);
    if (saved === 0) {
      setRoomMessage("Reorder was not saved (0 rows changed). Please tell your helper.");
      reorderLockRef.current = 0;
      return;
    }

    next.forEach((video, i) => positionsRef.current.set(video.youtubeId, i));
    reorderLockRef.current = 0;
    playlistPublishRef.current?.();
    playlistReloadRef.current?.();
    console.log("REORDER done, told the other browsers");
  }

  async function addLinkToPlaylist() {
    const id = parseYoutubeId(playlistLink);
    if (!id) {
      setPlaylistLinkMsg(
        "That doesn't look like a YouTube link. Paste the full link or the 11-character video ID."
      );
      return;
    }
    if (playlist.some((item) => item.youtubeId === id)) {
      setPlaylistLinkMsg("That video is already in the playlist.");
      return;
    }
    setPlaylistLinkMsg("Adding...");
    const known = videos.find((v) => v.youtubeId === id);
    const title = known ? known.title : (await fetchYoutubeTitle(id)) || "YouTube video";
    const video: Video = known ?? { ...videoFromYoutubeId(id), title };
    titleCacheRef.current.set(id, title);
    await addToPlaylist(video);
    setPlaylistLink("");
    setPlaylistLinkMsg(
      roomCode ? "Added to the playlist!" : "Added here. Join a room to share it with friends."
    );
  }

  async function sendMessage() {
  const text = chatInput.trim();

  if (!text || !roomCode) {
    setRoomMessage("Join a room before sending a message.");
    return;
  }

  const { error } = await supabase.from("messages").insert({
    room_code: roomCode,
    sender_name: displayName,
    content: text,
  });

  if (error) {
    console.warn("Send message failed:", error.message, error.code, error.details, error.hint);
    setRoomMessage(`Chat error: ${error.message}`);
    return;
  }

  setChatInput("");
}

  async function createPoll() {
    if (!roomCode) return;
    const question = newQuestion.trim();
    const options = newOptions.map((o) => o.trim()).filter(Boolean);

    if (!question) {
      setPollMessage("Type a question first.");
      return;
    }
    if (options.length < 2) {
      setPollMessage("Add at least 2 options.");
      return;
    }

    const { error } = await supabase.from("polls").insert({
      room_code: roomCode,
      question,
      options,
      created_by: displayName,
    });

    if (error) {
      console.warn("Create poll failed:", error.message, error.code);
      setPollMessage(`Could not start poll: ${error.message}`);
      return;
    }

    setShowPollForm(false);
    setNewQuestion("");
    setNewOptions(["", ""]);
  }

  async function vote(index: number) {
    if (myVote !== null) return;
    if (!roomCode) {
      setPollMessage("Join a room to vote.");
      return;
    }

    const { error } = await supabase.from("poll_votes").insert({
      room_code: roomCode,
      poll_id: activePollId,
      voter_name: displayName,
      option_index: index,
    });

    if (error) {
      console.warn("Vote failed:", error.message, error.code);
      setPollMessage(
        error.code === "23505"
          ? "You already voted in this poll."
          : `Vote failed: ${error.message}`
      );
      return;
    }

    setMyVote(index);
    setPollOptions((current) =>
      current.map((option, i) =>
        i === index ? { ...option, votes: option.votes + 1 } : option
      )
    );
    setPollMessage("Vote recorded!");
  }

  async function copyInvite() {
    const invite = `${window.location.origin}/?room=${roomCode}`;

    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setRoomMessage(`Share this invite link: ${invite}`);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090909] text-white">
      <IntroSplash />
      {roomOpen && roomCode && (
        <MovieBot
          roomCode={roomCode}
          displayName={displayName}
          catalog={videos.map((v) => ({
            title: v.title,
            category: v.category,
            year: v.year,
            description: v.description,
            youtubeId: v.youtubeId,
          }))}
          playlistTitles={playlist.map((v) => v.title)}
          pollQuestion={pollQuestion}
          onPlay={(youtubeId) => {
            const video = videos.find((v) => v.youtubeId === youtubeId);
            if (video) void selectVideo(video);
          }}
          onAddToPlaylist={(youtubeId) => {
            const video = videos.find((v) => v.youtubeId === youtubeId);
            if (video) void addToPlaylist(video);
          }}
        />
      )}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090909]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <a href="#" onClick={() => setPage("home")} className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-lg font-black shadow-lg shadow-red-600/20">
              W
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              watch<span className="text-red-500">party</span>
            </span>
          </a>

          <nav className="flex items-center gap-3 text-xs text-zinc-400 sm:gap-8 sm:text-sm">
            {([
              ["home", "Home"],
              ["watch", "Watch room"],
              ["discover", "Discover"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setPage(key);
                  window.scrollTo({ top: 0 });
                }}
                className={`border-b-2 pb-1 font-semibold transition hover:text-white ${
                  page === key ? "border-red-500 text-white" : "border-transparent"
                }`}
              >
                {label}
                {key === "watch" && roomOpen && page !== "watch" && (
                  <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-400" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-400 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Your movie night starts here
            </span>
            <button
              onClick={createRoom}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold transition hover:bg-red-500 active:scale-95"
            >
              + Create room
            </button>
          </div>
        </div>
      </header>

      <div className={page === "home" ? "" : "hidden"}>
<section className="mx-auto grid max-w-[1450px] gap-8 px-5 pb-12 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10 lg:pb-16 lg:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300">
            <span>✦</span> YOUR PEOPLE. YOUR MOVIE NIGHT.
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            Same screen.
            <br />
            <span className="text-red-500">Same moment.</span>
            <br />
            Different couches.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            Movie nights are better together. Pick something great, invite your
            favourite people, and make every reaction part of the experience.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={createRoom}
              className="rounded-xl bg-red-600 px-6 py-3.5 font-bold shadow-xl shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-red-500"
            >
              ▶ Start a watch party
            </button>
            <button
              onClick={() => {
                document.getElementById("join-room")?.focus();
                document.getElementById("join-room")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 font-semibold transition hover:bg-white/10"
            >
              Join a friend&apos;s room ↗
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-500">
            <span>◉ Watch together</span>
            <span>♡ React in real time*</span>
            <span>⌁ No movie night left behind</span>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            *Live multi-user features require the backend connection.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-8 rounded-full bg-red-600/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111] p-3 shadow-2xl shadow-black/60">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-red-950 via-zinc-900 to-black">
              <HeroTrailer active={!roomOpen && page === "home"} />


              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,rgba(239,68,68,0.36),transparent_40%),radial-gradient(ellipse_at_20%_90%,rgba(120,30,30,0.5),transparent_45%)]" />
              <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_48%,rgba(255,255,255,0.16)_49%,transparent_50%)] [background-size:24px_24px]" />
              <div className="absolute left-6 top-6 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />
                MOVIE NIGHT IS LIVE
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-300">
                  Together is better
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  The best nights
                  <br />
                  are shared.
                </p>
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-lg">
                <div className="flex -space-x-2">
                  {["M", "A", "J", "S"].map((letter, i) => (
                    <div
                      key={letter}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#191919] text-xs font-bold ${
                        i === 0
                          ? "bg-rose-500"
                          : i === 1
                            ? "bg-blue-500"
                            : i === 2
                              ? "bg-amber-500 text-black"
                              : "bg-emerald-500 text-black"
                      }`}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">Your crew</p>
                  <p className="text-xs text-zinc-400">Good films, better company</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-4">
              <div>
                <p className="text-sm font-bold">Tonight&apos;s main event</p>
                <p className="mt-1 text-xs text-zinc-500">
                  One room. Endless memories.
                </p>
              </div>
              <span className="rounded-lg bg-red-600/15 px-3 py-2 text-xs font-bold text-red-300">
                LET&apos;S WATCH
              </span>
            </div>
          </div>
        </div>
      </section>

      </div>

      {page === "home" && (
<section className="relative overflow-hidden bg-[#06100d] py-16">
              <div className="px-6 text-center">
                <h2 className="text-3xl font-black sm:text-5xl">Connecting people all over the world</h2>
                <p className="mx-auto mt-3 max-w-xl text-zinc-400">Friends in different cities, one movie, perfectly in sync.</p>
              </div>
              <LiveGlobe
                users={[
                  { lat: 13.08, lng: 80.27, name: "Chennai" },
                  { lat: 51.5, lng: -0.1, name: "London" },
                  { lat: 40.7, lng: -74, name: "New York" },
                  { lat: 35.7, lng: 139.7, name: "Tokyo" },
                ]}
                arcs={[
                  { startLat: 13.08, startLng: 80.27, endLat: 51.5, endLng: -0.1 },
                  { startLat: 40.7, startLng: -74, endLat: 35.7, endLng: 139.7 },
                ]}
              />
            </section>
)}

{roomOpen && (
        <section className="mx-auto max-w-[1450px] px-5 pb-8 lg:px-10">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-300">
                Your watch room
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-2xl font-black">{roomCode}</p>
                <ConnectionPill roomCode={roomCode} />
              </div>
              <p className="mt-1 text-sm text-zinc-400">{roomMessage}</p>
              {renaming && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void renameSelf();
                  }}
                  className="mt-3 flex flex-wrap items-center gap-2"
                >
                  <input
                    value={renameInput}
                    onChange={(event) => {
                      setRenameInput(event.target.value);
                      setRenameMsg("");
                    }}
                    placeholder="New name"
                    aria-label="New name"
                    maxLength={20}
                    autoFocus
                    className="min-w-0 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-200">
                    Save name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(false);
                      setRenameMsg("");
                    }}
                    className="rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-300"
                  >
                    Cancel
                  </button>
                  {renameMsg && <p className="w-full text-xs text-red-300">{renameMsg}</p>}
                </form>
              )}
              {connection === "reconnecting" && (
                <p className="mt-2 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                  Connection lost - reconnecting...
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                {isHost ? "You are the host · " : ""}
                Sync:{" "}
                {driftMs === null
                  ? "waiting for the room..."
                  : `${driftMs} ms off (auto-corrected if over 500)`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">
                  In the room ({participants.length}):
                </span>
                {participants.map((p) => (
                  <span
                    key={p.key}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold"
                  >
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-400" />
                    {p.name}
                    {p.key === displayName ? " (you)" : ""}
                    {p.key === hostName && (
                      <span className="ml-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase">
                        Host
                      </span>
                    )}
                    {isHost && p.key !== displayName && (
                      <button
                        onClick={() => void makeHost(p.key)}
                        className="ml-2 rounded-md bg-amber-400 px-3 py-1 text-xs font-black uppercase text-black shadow-lg shadow-amber-900/40 ring-1 ring-white/40 transition hover:scale-105 hover:bg-amber-300"
                      >
                        Make host
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
              <button
                onClick={copyInvite}
                className="rounded-xl bg-white px-4 py-3 font-bold text-black transition hover:bg-zinc-200"
              >
                {copied ? "✓ Invite copied" : "↗ Copy invite link"}
              </button>
              <button
                onClick={() => {
                  setRenaming((v) => !v);
                  setRenameInput("");
                  setRenameMsg("");
                }}
                className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 font-bold text-zinc-200 transition hover:bg-white/10"
              >
                Change name
              </button>
              <button
                onClick={leaveRoom}
                className="rounded-xl border border-red-500/60 bg-red-600/20 px-4 py-3 font-bold text-red-200 transition hover:bg-red-600 hover:text-white"
              >
                Leave room
              </button>
            </div>
          </div>
        </section>
      )}

      <div className={page === "home" ? "" : "hidden"}>
<section
        id="join-room"
        className="mx-auto max-w-[1450px] px-5 pb-12 lg:px-10"
      >
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-[#111] p-5 md:grid-cols-[1fr_auto_1fr] md:items-center md:p-7">
          <div>
            <p className="font-bold">Have a room code?</p>
            <p className="mt-1 text-sm text-zinc-500">
              Jump into your friend&apos;s movie night.
            </p>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              maxLength={20}
              placeholder="Your name"
              aria-label="Your name"
              className="mt-3 w-full rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-red-500 md:max-w-xs"
            />
            <p className="mt-1 text-xs text-zinc-600">
              Creating a room? Leave it empty to be &quot;Host&quot;.
            </p>
          </div>
          <div className="hidden h-12 w-px bg-white/10 md:block" />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom();
            }}
            className="flex gap-2"
          >
            <input
              id="join-room-input"
              value={roomCodeInput}
              onChange={(event) => {
                const value = event.target.value;
                setRoomCodeInput(/room=/i.test(value) ? extractRoomCode(value) : value);
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                if (!/room=/i.test(pasted)) return;
                const pastedCode = extractRoomCode(pasted);
                if (!/^[A-Z0-9]{6}$/.test(pastedCode)) return;
                event.preventDefault();
                setRoomCodeInput(pastedCode);
                void joinRoom(pastedCode);
              }}
              placeholder="ROOM CODE OR INVITE LINK"
              aria-label="Room code"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm uppercase tracking-widest outline-none placeholder:text-zinc-600 focus:border-red-500"
            />
            <button className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200">
              Join room
            </button>
          </form>
          {roomMessage && !roomOpen && (
            <p className="text-sm text-red-300 md:col-span-3">{roomMessage}</p>
          )}
        </div>
      </section>

      </div>

{/* wp-joinfirst: the Watch room page asks you to join a room first */}
      {page === "watch" && !roomOpen && (
        <section className="mx-auto max-w-[1450px] px-5 py-16 lg:px-10">
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#111] p-10 text-center shadow-2xl shadow-black/50">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-3xl">
              🍿
            </div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Join a room first
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
              The video, chat, playlist and polls appear once you are inside a
              room. Start a new one, or enter a friend&apos;s room code.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                onClick={createRoom}
                className="rounded-xl bg-red-600 px-6 py-3 font-bold shadow-xl shadow-red-950/30 transition hover:bg-red-500"
              >
                + Create room
              </button>
              <button
                onClick={() => {
                  setPage("home");
                  window.setTimeout(() => {
                    const box = document.getElementById("join-room-input");
                    box?.scrollIntoView({ behavior: "smooth", block: "center" });
                    box?.focus();
                  }, 150);
                }}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 font-semibold transition hover:bg-white/10"
              >
                Enter a room code
              </button>
            </div>
          </div>
        </section>
      )}

      <div className={page === "watch" && roomOpen ? "" : "pointer-events-none fixed -left-[9999px] top-0 w-[1100px]"}>
<section
        id="watch"
        className="mx-auto max-w-[1450px] px-5 pb-14 lg:px-10"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
              The main event
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl"><ScrambleText text="The watch room" /></h2>
            <p className="mt-2 text-sm text-zinc-500">
              Pick a video and settle in.
            </p>
          </div>
          <button
            onClick={() => setShowYoutubeInput((current) => !current)}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold transition hover:border-red-500/50 hover:bg-white/5"
          >
            + Add YouTube video
          </button>
        </div>

        {showYoutubeInput && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addYoutubeVideo();
            }}
            className="mb-5 flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#111] p-4 sm:flex-row"
          >
            <input
              value={youtubeInput}
              onChange={(event) => setYoutubeInput(event.target.value)}
              placeholder="Paste a YouTube video URL or 11-character ID"
              aria-label="YouTube video URL"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-red-500"
            />
            <button className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500">
              Play video
            </button>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.65fr_0.75fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
            <div className="relative aspect-video bg-black">
              <div ref={playerBoxRef} className="absolute inset-0 h-full w-full" />
              <div className="wp-float-layer pointer-events-none absolute inset-0 z-10 overflow-hidden">
                {floating.map((f) => (
                  <div
                    key={f.id}
                    className={`wp-float-${f.variant} absolute flex flex-col items-center`}
                    style={{ left: `${f.left}%` }}
                  >
                    <span className="text-4xl">{f.emoji}</span>
                    <span className="mt-0.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-wider">
                    Now selected
                  </span>
                  <span className="text-xs text-zinc-500">
                    {selectedVideo.category} · {selectedVideo.year}
                  </span>
                </div>
                <h3 className="text-xl font-bold">{selectedVideo.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {selectedVideo.description}
                </p>
              </div>
              <div className="flex gap-2">
                {["❤️", "😂", "🔥", "👏"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    aria-label={`React ${emoji}`}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-lg transition hover:scale-110 hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="flex min-h-[420px] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
            <div className="flex border-b border-white/10">
              {["Chat", "Playlist", "Polls"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  onMouseMove={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
                    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
                  }}
                  className={`wp-tab relative flex-1 px-2 py-4 text-sm font-bold transition ${
                    activeTab === tab
                      ? "border-b-2 border-red-500 bg-white/[0.03] text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "Chat" && (
              <>
                <div
                  ref={chatScrollRef}
                  onScroll={(event) => {
                    const box = event.currentTarget;
                    chatStickRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
                  }}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
                >
                  <div className="mb-2 rounded-xl bg-white/[0.04] p-3 text-center text-xs text-zinc-500">
                    Welcome to the conversation ✨
                  </div>
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(message.name)} text-xs font-black`}>
                        {message.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold">{message.name}</span>
                          <span className="text-[10px] text-zinc-600">
                            {message.time}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm text-zinc-300">
                          {message.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage();
                  }}
                  className="flex gap-2 border-t border-white/10 p-3"
                >
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Say something..."
                    aria-label="Chat message"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-3 text-sm outline-none focus:border-red-500"
                  />
                  <button
                    aria-label="Send message"
                    className="rounded-xl bg-red-600 px-4 font-bold hover:bg-red-500"
                  >
                    ↑
                  </button>
                </form>
              </>
            )}

            {activeTab === "Playlist" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold">Up next</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {playlist.length} videos in your list
                    </p>
                  </div>
                  <span className="text-xl">♫</span>
                </div>
                <div className="space-y-3">
                  {playlist.map((video, index) => (
                    <div
                      key={video.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(index));
                        setDragIndex(index);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (overIndex !== index) setOverIndex(index);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragIndex !== null) void movePlaylistItem(dragIndex, index);
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={`flex items-center gap-3 rounded-xl border bg-white/[0.02] p-2 transition ${
                        dragIndex === index ? "opacity-40" : ""
                      } ${
                        overIndex === index && dragIndex !== null && dragIndex !== index
                          ? "border-red-500"
                          : "border-white/[0.06]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        title="Drag to reorder"
                        className="cursor-grab select-none px-0.5 text-zinc-600 hover:text-zinc-300"
                      >
                        ⋮⋮
                      </span>
                      <button
                        onClick={() => selectVideo(video)}
                        className={`relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${video.color} text-lg`}
                        aria-label={`Play ${video.title}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl(video.youtubeId)}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[10px]">
                          ▶
                        </span>
                      </button>
                      <button
                        onClick={() => selectVideo(video)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-bold">{video.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {index + 1} · {video.category}{addedBy[video.youtubeId] ? ` · added by ${addedBy[video.youtubeId]}` : ""}
                        </p>
                      </button>
                      <button
                        onClick={() => removeFromPlaylist(video)}
                        aria-label={`Remove ${video.title}`}
                        className="px-2 text-zinc-600 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addLinkToPlaylist();
                  }}
                  className="mt-4 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      value={playlistLink}
                      onChange={(event) => setPlaylistLink(event.target.value)}
                      placeholder="Paste a YouTube link for later"
                      aria-label="YouTube link to add to the playlist"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-red-500"
                    />
                    <button className="rounded-xl bg-red-600 px-4 text-sm font-bold hover:bg-red-500">
                      Add
                    </button>
                  </div>
                  {playlistLinkMsg && (
                    <p className="text-xs text-zinc-400">{playlistLinkMsg}</p>
                  )}
                </form>
                <button
                  onClick={() => {
                    const next = videos.find(
                      (video) =>
                        !playlist.some((item) => item.id === video.id)
                    );
                    if (next) void addToPlaylist(next);
                    else setRoomMessage("All sample videos are already in the playlist.");
                  }}
                  className="mt-4 w-full rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-zinc-400 transition hover:border-red-500/50 hover:text-white"
                >
                  + Add a discovery pick
                </button>
              </div>
            )}

            {activeTab === "Polls" && (
              <div className="flex-1 overflow-y-auto p-5">
                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                  GROUP POLL
                </span>
                <h3 className="mt-4 text-lg font-bold">{pollQuestion || "No poll yet"}</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {activePollId
                    ? "Pick one option."
                    : isHost
                      ? "Start a poll for your room below."
                      : "Waiting for the host to start a poll."}
                </p>
                <div className="mt-5 space-y-3">
                  {pollOptions.map((option, index) => {
                    const total = pollOptions.reduce(
                      (sum, item) => sum + item.votes,
                      0
                    );
                    const percentage = total
                      ? Math.round((option.votes / total) * 100)
                      : 0;

                    return (
                      <button
                        key={`${index}-${option.label}`}
                        disabled={myVote !== null}
                        onClick={() => vote(index)}
                        className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${
                          myVote === index
                            ? "border-red-500"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <span
                          className="absolute inset-y-0 left-0 bg-red-600/15 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="relative flex items-center justify-between gap-2 text-sm">
                          <span>{option.label}</span>
                          {myVote !== null && (
                            <span className="text-xs text-zinc-400">
                              {percentage}%
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-zinc-500">
                  {myVote === null
                    ? (activePollId ? "Vote once to see the results." : "")
                    : `${pollOptions.reduce((sum, item) => sum + item.votes, 0)} votes · Thanks for voting!`}
                </p>
                {isHost && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    {!showPollForm ? (
                      <button
                        onClick={() => setShowPollForm(true)}
                        className="w-full rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-zinc-400 transition hover:border-red-500/50 hover:text-white"
                      >
                        + New poll (host)
                      </button>
                    ) : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          createPoll();
                        }}
                        className="space-y-2"
                      >
                        <input
                          value={newQuestion}
                          onChange={(event) => setNewQuestion(event.target.value)}
                          placeholder="Your question"
                          aria-label="Poll question"
                          className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500"
                        />
                        {newOptions.map((option, i) => (
                          <input
                            key={i}
                            value={option}
                            onChange={(event) =>
                              setNewOptions((current) =>
                                current.map((o, j) =>
                                  j === i ? event.target.value : o
                                )
                              )
                            }
                            placeholder={`Option ${i + 1}`}
                            aria-label={`Option ${i + 1}`}
                            className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500"
                          />
                        ))}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {newOptions.length < 6 && (
                            <button
                              type="button"
                              onClick={() =>
                                setNewOptions((current) => [...current, ""])
                              }
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                            >
                              + Option
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowPollForm(false)}
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button className="ml-auto rounded-lg bg-red-600 px-4 py-2 text-xs font-bold hover:bg-red-500">
                            Start poll
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
                {pollMessage && (
                  <p className="mt-2 text-xs text-green-400">{pollMessage}</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>

      </div>

<div className={page === "discover" ? "" : "hidden"}>
<section
        id="discover"
        className="mx-auto max-w-[1450px] px-5 pb-20 lg:px-10"
      >
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
              Find your next obsession
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Tonight&apos;s watchlist
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Great picks for your next group watch.
            </p>
          </div>
          <label className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#111] px-4 py-3 lg:max-w-sm">
            <span className="text-lg text-zinc-500">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movies or genres..."
              aria-label="Search movies"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-zinc-500 hover:text-white"
              >
                ×
              </button>
            )}
          </label>
        </div>

        <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                category === item
                  ? "bg-red-600 text-white"
                  : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {filteredVideos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111] py-16 text-center">
            <p className="text-3xl">🎬</p>
            <h3 className="mt-4 text-lg font-bold">No movies found</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Try another title or category.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {filteredVideos.map((video) => (
              <article
                key={video.id}
                className="group relative min-w-0 transition-transform duration-200 hover:z-20 hover:scale-[1.15]"
                onMouseEnter={() => startPreview(video.id)}
                onMouseLeave={stopPreview}
                onClickCapture={stopPreview}
              >
                <button
                  onClick={() => {
                    selectVideo(video);
                    setPage("watch");
                    window.scrollTo({ top: 0 });
                  }}
                  className={`relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${video.color} text-left transition duration-300 group-hover:-translate-y-1 group-hover:border-red-500/60`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={"https://i.ytimg.com/vi/" + video.youtubeId + "/hqdefault.jpg"}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    className="wp-poster-img absolute inset-0 h-full w-full object-cover opacity-80"
                  />
                  {previewId === video.id && page === "discover" && (
                    <div
                      className={`pointer-events-none absolute inset-0 overflow-hidden bg-black transition-opacity duration-500 ${
                        previewReady ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <iframe
                        key={previewKey}
                        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&cc_load_policy=0&enablejsapi=1&start=25&origin=${encodeURIComponent(window.location.origin)}`}
                        title="preview"
                        allow="autoplay; encrypted-media"
                        tabIndex={-1}
                        onLoad={(event) => {
                          event.currentTarget.contentWindow?.postMessage(
                            JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
                            "*"
                          );
                          window.setTimeout(() => setPreviewReady(true), 3000);
                        }}
                        className="absolute left-1/2 -top-[15%] h-[130%] w-[310%] -translate-x-1/2 border-0 pointer-events-none"
                      />
                      <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/80 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-black/90 to-transparent" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,rgba(255,255,255,0.12),transparent_55%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <div className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-bold backdrop-blur">
                    {video.category}
                  </div>
                  <div className="absolute inset-x-3 bottom-4">
                    <p className="text-xs font-semibold text-white/60">
                      {video.year}
                    </p>
                    <h3 className="mt-1 text-lg font-black leading-tight">
                      {video.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-300">
                      {video.description}
                    </p>
                  </div>
                  <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm opacity-0 shadow-lg transition group-hover:opacity-100">
                    ▶
                  </span>
                  <span className="absolute bottom-3 right-3 text-[10px] text-white/60">
                    {video.duration}
                  </span>
                </button>
                <button
                  onClick={() => addToPlaylist(video)}
                  className="mt-2 w-full rounded-lg border border-white/10 py-2 text-xs font-semibold text-zinc-400 transition hover:border-red-500/40 hover:text-white"
                >
                  + Add to playlist
                </button>
              </article>
            ))}
          </div>
        )}
      </section>



</div>

<div className={page === "home" ? "" : "hidden"}>
<CommunitySection
        onWatch={(video) => {
          void selectVideo(video);
          setPage("watch");
                    window.scrollTo({ top: 0 });
        }}
        onAdd={(video) => void addToPlaylist(video)}
      />

</div>

<MeasurePanel roomCode={roomCode} people={participants.length} />

<footer className="overflow-hidden border-t border-white/10 bg-black py-8">
  <div className="relative overflow-hidden">
    <div className="watch-party-marquee flex w-max items-center text-sm font-extrabold uppercase tracking-[0.2em] sm:text-base">
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className="flex shrink-0 items-center gap-8 pr-8"
        >
          <span className="text-white">WATCH</span>
          <span className="text-red-500">PARTY</span>
          <span className="text-zinc-500">✦</span>
          <span className="text-zinc-300">
            BUILT FOR YOUR NEXT MOVIE NIGHT
          </span>
          <span className="text-red-500">✦</span>
          <span className="text-white">GOOD MOVIES.</span>
          <span className="text-red-500">GREAT PEOPLE.</span>
          <span className="text-white">BETTER NIGHTS.</span>
          <span className="text-zinc-500">✦</span>
        </div>
      ))}
    </div>
  </div>
</footer>
</main>
  );
}
