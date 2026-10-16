// Free movie bot: recommendations use the room's catalogue; no AI API key needed.

type CatalogItem = {
  title: string;
  category: string;
  year: string;
  description: string;
};

type Pick = { title: string; year: string; why: string };

const COOLDOWN_MS = 8000; // one question per room every 8 seconds
const lastCallByRoom = new Map<string, number>();

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

const GREETING =
  /^(hi+|hello+|hey+|yo|sup|hola|namaste|thanks?|thank you|thx|ok(ay)?|cool|nice|great|awesome|bye|good (morning|night|evening|afternoon)|how are you|who are you|what can you do|lol|haha+)\b/i;
const MOVIE_WORDS =
  /movie|film|watch|show|series|recommend|suggest|genre|funny|comedy|horror|scary|thriller|sci-?fi|action|romanc|drama|animat|documentar|mood|tonight|cozy|pick/i;

// Greetings, thanks and other small talk (no movie request in it)
function isSmallTalk(question: string): boolean {
  const q = question.trim();
  if (q.length > 60) return false;
  return GREETING.test(q) && !MOVIE_WORDS.test(q);
}

function smallTalkReply(question: string): string {
  const q = question.toLowerCase();
  if (/thank|thx/.test(q)) return "You are welcome!";
  if (/bye|good night/.test(q)) return "Bye! Enjoy the rest of your night.";
  if (/how are you/.test(q)) return "I am doing great, thanks for asking! How about you?";
  if (/who are you|what can you do/.test(q))
    return "I am the Movie Bot. I can chat with you, and I can pick movies whenever you want some.";
  return "Hi there! Nice to chat with you.";
}

// Detect explicit genre requests and filter BEFORE recommending.
function requestedGenres(question: string): string[] {
  const q = question.toLowerCase();
  const genres: string[] = [];

  if (/romanc|romantic|love stor|date night/.test(q)) genres.push("romance");
  if (/comedy|comedies|funny|hilarious|feel.?good/.test(q)) genres.push("comedy");
  if (/sci.?fi|science fiction|space movie|mind.?bending/.test(q)) genres.push("sci-fi");
  if (/horror|scary|terrifying|supernatural/.test(q)) genres.push("horror");
  if (/thriller|suspense|mystery|crime/.test(q)) genres.push("thriller");
  if (/action|adventure|superhero/.test(q)) genres.push("action");
  if (/drama|emotional|tearjerker|sad movie/.test(q)) genres.push("drama");
  if (/animation|animated|cartoon/.test(q)) genres.push("animation");

  return [...new Set(genres)];
}

function matchesGenres(movie: CatalogItem, genres: string[]): boolean {
  if (genres.length === 0) return true;

  const text = `${movie.category} ${movie.title} ${movie.description}`.toLowerCase();
  const aliases: Record<string, RegExp> = {
    romance: /romance|romantic|love story|date night/,
    comedy: /comedy|comedies|funny|hilarious|humou?r|satire/,
    "sci-fi": /sci.?fi|science fiction|space|alien|futuristic|time travel/,
    horror: /horror|scary|terror|supernatural|haunted|monster/,
    thriller: /thriller|suspense|mystery|crime|detective/,
    action: /action|adventure|superhero|fight|spy/,
    drama: /drama|emotional|family conflict|tearjerker/,
    animation: /animation|animated|cartoon/,
  };

  // Every requested genre must match.
  return genres.every((genre) => aliases[genre].test(text));
}

function fallbackPicks(question: string, catalog: CatalogItem[], taken: string[]): Pick[] {
  const genres = requestedGenres(question);
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

  const eligible = catalog
    .filter((m) => !taken.includes(m.title.toLowerCase()))
    .filter((m) => matchesGenres(m, genres));

  // Never fill the results with unrelated movies when nothing matches.
  if (eligible.length === 0) return [];

  const scored = eligible
    .map((m) => {
      const text = `${m.title} ${m.category} ${m.description}`.toLowerCase();
      const score = words.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);
      return { m, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ m }) => ({
    title: m.title,
    year: m.year,
    why: m.description,
  }));
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const question = clip(body.question, 300);
  const roomCode = clip(body.roomCode, 6).toUpperCase();

  if (!question) {
    return Response.json({ error: "Type a question first." }, { status: 400 });
  }

  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    return Response.json({ error: "Join a room first." }, { status: 400 });
  }

  // Keep the existing per-room cooldown.
  const now = Date.now();
  const last = lastCallByRoom.get(roomCode) ?? 0;

  if (now - last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return Response.json(
      { error: `The bot is catching its breath. Try again in ${wait}s.` },
      { status: 429 }
    );
  }

  lastCallByRoom.set(roomCode, now);
  if (lastCallByRoom.size > 500) lastCallByRoom.clear();

  const catalog: CatalogItem[] = (Array.isArray(body.catalog) ? body.catalog : [])
    .slice(0, 30)
    .map((c) => {
      const item = c as Record<string, unknown>;
      return {
        title: clip(item.title, 80),
        category: clip(item.category, 30),
        year: clip(item.year, 8),
        description: clip(item.description, 120),
      };
    })
    .filter((item) => item.title);

  const playlist: string[] = (Array.isArray(body.playlist) ? body.playlist : [])
    .slice(0, 30)
    .map((item) => clip(item, 80))
    .filter(Boolean);

  const taken = playlist.map((title) => title.toLowerCase());

  if (isSmallTalk(question)) {
    return Response.json({
      intro: smallTalkReply(question),
      picks: [],
      source: "free",
    });
  }

  const genres = requestedGenres(question);
  const picks = fallbackPicks(question, catalog, taken);

  if (picks.length === 0) {
    const searchTerm = genres.length > 0
      ? genres.join(" ") + " movies"
      : question + " movies";

    const youtubeUrl =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(searchTerm);

    return Response.json({
      intro:
        "I couldn't find a suitable match in this room's movie list. " +
        "Try searching YouTube here: " + youtubeUrl,
      picks: [],
      source: "free",
    });
  }

  return Response.json({
    intro: "Here are the closest matches from your room's movie list!",
    picks,
    source: "free",
  });
}

