export type BoardRole = "user" | "assistant";

export type BoardMessage = {
  id: string;
  role: BoardRole;
  parts: [{ type: "text"; text: string }];
  createdAt: string;
};

export type BoardCard = {
  id: string;
  kind: "note" | "task" | "heading";
  title: string;
  body: string;
  x: number;
  y: number;
  color: "white" | "yellow" | "blue" | "green";
  done?: boolean;
};

export type BoardStroke = {
  id: string;
  points: { x: number; y: number }[];
  color: "ink" | "blue" | "red";
  width: number;
};

export type BoardThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: BoardMessage[];
  cards: BoardCard[];
  strokes: BoardStroke[];
};

export const THREADS_KEY = "air-nano-board.threads";

export function makeThreadId() {
  return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeMessage(role: BoardRole, text: string): BoardMessage {
  return {
    id: `message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    parts: [{ type: "text", text }],
    createdAt: new Date().toISOString(),
  };
}

export function createThread(template: "blank" | "meeting" | "lesson" | "project" = "blank"): BoardThread {
  const now = new Date().toISOString();
  const presets: Record<string, { name: string; cards: Array<Pick<BoardCard, "kind" | "title" | "body" | "color">> }> = {
    blank: { name: "Untitled board", cards: [] },
    meeting: { name: "Team meeting", cards: [
      { kind: "heading", title: "Team meeting", body: "Date · Attendees · Goal", color: "white" },
      { kind: "note", title: "Agenda", body: "1. Updates\n2. Decisions\n3. Next steps", color: "yellow" },
      { kind: "note", title: "Decisions", body: "Record what was agreed and why.", color: "blue" },
      { kind: "task", title: "Follow up", body: "Owner · Due date", color: "green" },
    ] },
    lesson: { name: "Lesson plan", cards: [
      { kind: "heading", title: "Lesson plan", body: "Subject · Class · Date", color: "white" },
      { kind: "note", title: "Learning objectives", body: "By the end of class, students will…", color: "yellow" },
      { kind: "note", title: "Activities", body: "Warm-up\nPractice\nDiscussion", color: "blue" },
      { kind: "task", title: "Assessment", body: "How will you check understanding?", color: "green" },
    ] },
    project: { name: "Project plan", cards: [
      { kind: "heading", title: "Project plan", body: "Outcome · Timeline · Team", color: "white" },
      { kind: "note", title: "Scope", body: "What is in and out of scope?", color: "yellow" },
      { kind: "task", title: "First milestone", body: "Owner · Due date", color: "green" },
      { kind: "note", title: "Risks & questions", body: "Capture unknowns here.", color: "blue" },
    ] },
  };
  const preset = presets[template];
  return {
    id: makeThreadId(),
    title: preset.name,
    updatedAt: now,
    messages: [],
    cards: preset.cards.map((card, index) => ({ ...card, id: makeThreadId(), x: 80 + (index % 2) * 310, y: 100 + Math.floor(index / 2) * 230 })),
    strokes: [],
  };
}

export function readThreads(): BoardThread[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(THREADS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as BoardThread[];
    return Array.isArray(parsed) ? parsed.map((thread) => ({
      ...thread,
      cards: Array.isArray(thread.cards) ? thread.cards : [],
      strokes: Array.isArray(thread.strokes) ? thread.strokes : [],
      messages: Array.isArray(thread.messages) ? thread.messages : [],
    })) : [];
  } catch {
    return [];
  }
}

export function writeThreads(threads: BoardThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

export function ensureThreads() {
  const current = readThreads();
  if (current.length > 0) return current;
  const initial = [createThread()];
  writeThreads(initial);
  return initial;
}

export function findThread(threadId: string) {
  return readThreads().find((thread) => thread.id === threadId);
}
