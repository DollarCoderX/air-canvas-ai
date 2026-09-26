import { useEffect, useRef, useState, type PointerEvent, type ChangeEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDownToLine, ArrowUp, Check, CheckSquare2, ChevronDown, ClipboardList, Copy, FilePlus2, GraduationCap, Grid2X2, Layers2, Menu, MessageCircle, MousePointer2, PenLine, Plus, RotateCcw, Search, Settings2, Square, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { type BoardCard, type BoardStroke, type BoardThread, createThread, ensureThreads, makeMessage, makeThreadId, readThreads, writeThreads } from "@/lib/board-storage";

type Tool = "select" | "pen" | "chat" | "settings";
type Template = "blank" | "meeting" | "lesson" | "project";
const templates: { id: Template; label: string; icon: typeof Square }[] = [
  { id: "blank", label: "Blank board", icon: Square },
  { id: "meeting", label: "Team meeting", icon: ClipboardList },
  { id: "lesson", label: "Lesson plan", icon: GraduationCap },
  { id: "project", label: "Project plan", icon: Layers2 },
];
const cardColors: BoardCard["color"][] = ["white", "yellow", "blue", "green"];
const cardClass: Record<BoardCard["color"], string> = {
  white: "bg-card", yellow: "bg-note-yellow", blue: "bg-note-blue", green: "bg-note-green",
};
const inkClass: Record<BoardStroke["color"], string> = { ink: "stroke-ink", blue: "stroke-softblue", red: "stroke-destructive" };
const inkSwatch: Record<BoardStroke["color"], string> = { ink: "bg-ink", blue: "bg-softblue", red: "bg-destructive" };

function updateStoredThread(updated: BoardThread) {
  writeThreads(readThreads().map((thread) => thread.id === updated.id ? updated : thread));
}
function cardText(card: BoardCard) { return `${card.title}${card.body ? ` — ${card.body}` : ""}`; }
function downloadBoard(thread: BoardThread) {
  const blob = new Blob([JSON.stringify({ format: "air-nano-board", version: 1, title: thread.title, cards: thread.cards, strokes: thread.strokes }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${thread.title.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "board"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AirNanoBoard({ requestedThreadId }: { requestedThreadId?: string }) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<BoardThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState(requestedThreadId ?? "");
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(100);
  const [grid, setGrid] = useState(true);
  const [ink, setInk] = useState<BoardStroke["color"]>("ink");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBoards, setShowBoards] = useState(false);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [draftStroke, setDraftStroke] = useState<BoardStroke | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ id: string; x: number; y: number; originalX: number; originalY: number } | null>(null);
  const thread = threads.find((item) => item.id === activeThreadId);
  const cards = thread?.cards ?? [];
  const strokes = thread?.strokes ?? [];
  const selectedCard = selected.length === 1 ? cards.find((item) => item.id === selected[0]) : undefined;

  useEffect(() => {
    const stored = ensureThreads();
    setThreads(stored);
    const id = requestedThreadId && stored.some((item) => item.id === requestedThreadId) ? requestedThreadId : stored[0]?.id;
    setActiveThreadId(id ?? "");
    if (id && id !== requestedThreadId) void navigate({ to: "/$threadId", params: { threadId: id }, replace: true });
  }, [requestedThreadId, navigate]);
  useEffect(() => { if (tool === "chat") textareaRef.current?.focus(); }, [tool, activeThreadId]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function save(patch: Partial<BoardThread>) {
    if (!thread) return;
    const updated = { ...thread, ...patch, updatedAt: new Date().toISOString() };
    setThreads((current) => current.map((item) => item.id === updated.id ? updated : item));
    updateStoredThread(updated);
  }
  function createBoard(template: Template) {
    const next = createThread(template);
    const all = [next, ...readThreads()];
    writeThreads(all);
    setThreads(all);
    setSelected([]);
    setActiveThreadId(next.id);
    setShowTemplates(false);
    setShowBoards(false);
    setTool("select");
    void navigate({ to: "/$threadId", params: { threadId: next.id } });
  }
  function openBoard(id: string) {
    setSelected([]);
    setActiveThreadId(id);
    setShowBoards(false);
    setTool("select");
    void navigate({ to: "/$threadId", params: { threadId: id } });
  }
  function deleteBoard() {
    if (!thread || !window.confirm(`Delete “${thread.title}”? This cannot be undone.`)) return;
    let next = readThreads().filter((item) => item.id !== thread.id);
    if (!next.length) next = [createThread()];
    writeThreads(next);
    setThreads(next);
    setSelected([]);
    setActiveThreadId(next[0].id);
    void navigate({ to: "/$threadId", params: { threadId: next[0].id }, replace: true });
  }
  function addCard(kind: BoardCard["kind"]) {
    if (!thread) return;
    const card: BoardCard = { id: makeThreadId(), kind, title: kind === "task" ? "New task" : kind === "heading" ? "Section heading" : "New note", body: "", x: 40 + Math.round(Math.random() * 30), y: 120 + Math.round(Math.random() * 60), color: kind === "task" ? "green" : "yellow", done: false };
    save({ cards: [...cards, card] });
    setSelected([card.id]);
    setTool("select");
  }
  function patchCard(id: string, patch: Partial<BoardCard>) { save({ cards: cards.map((card) => card.id === id ? { ...card, ...patch } : card) }); }
  function removeSelected() { save({ cards: cards.filter((card) => !selected.includes(card.id)) }); setSelected([]); }
  function duplicateSelected() {
    const copies = cards.filter((card) => selected.includes(card.id)).map((card) => ({ ...card, id: makeThreadId(), x: card.x + 28, y: card.y + 28 }));
    save({ cards: [...cards, ...copies] });
    setSelected(copies.map((card) => card.id));
  }
  function convertSelected() { save({ cards: cards.map((card) => selected.includes(card.id) ? { ...card, kind: "task", color: "green" } : card) }); }
  function startDrag(event: PointerEvent<HTMLDivElement>, card: BoardCard) {
    if (tool !== "select" || (event.target as HTMLElement).closest("button, input, textarea")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: card.id, x: event.clientX, y: event.clientY, originalX: card.x, originalY: card.y };
    setSelected((current) => event.shiftKey ? current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id] : current.includes(card.id) ? current : [card.id]);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>, card: BoardCard) {
    const drag = dragRef.current;
    if (!drag || drag.id !== card.id) return;
    const dx = (event.clientX - drag.x) / (zoom / 100), dy = (event.clientY - drag.y) / (zoom / 100);
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    save({ cards: cards.map((item) => selected.includes(item.id) || item.id === card.id ? { ...item, x: Math.max(0, item.x + (event.movementX / (zoom / 100))), y: Math.max(0, item.y + (event.movementY / (zoom / 100))) } : item) });
  }
  function canvasPoint(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / (zoom / 100), y: (event.clientY - rect.top) / (zoom / 100) };
  }
  function startStroke(event: PointerEvent<SVGSVGElement>) {
    if (tool !== "pen") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftStroke({ id: makeThreadId(), color: ink, width: 3, points: [canvasPoint(event)] });
  }
  function finishStroke() {
    if (draftStroke && draftStroke.points.length > 1) save({ strokes: [...strokes, draftStroke] });
    setDraftStroke(null);
  }
  function sendPrompt() {
    if (!thread || !prompt.trim()) return;
    const text = prompt.trim();
    const scope = selected.length ? cards.filter((card) => selected.includes(card.id)) : cards;
    const normalized = text.toLowerCase();
    let answer: string;
    if (!scope.length) answer = "This board is empty. Add a note or task to start working with its contents.";
    else if (/action|task|to.do|next step/.test(normalized)) answer = `Action list from ${selected.length ? "your selection" : "this board"}:\n${scope.map((card, i) => `${i + 1}. ${card.kind === "task" ? "Complete" : "Review"} ${card.title}${card.body ? ` — ${card.body.replace(/\n/g, "; ")}` : ""}`).join("\n")}`;
    else if (/count|how many|status|progress/.test(normalized)) answer = `${scope.length} items: ${scope.filter((card) => card.kind === "task").length} tasks (${scope.filter((card) => card.kind === "task" && card.done).length} complete), ${scope.filter((card) => card.kind === "note").length} notes, and ${scope.filter((card) => card.kind === "heading").length} headings.`;
    else answer = `Board summary${selected.length ? " of selected items" : ""}:\n${scope.map((card) => `• ${cardText(card).replace(/\n/g, "; ")}`).join("\n")}`;
    save({ messages: [...thread.messages, makeMessage("user", text), makeMessage("assistant", answer)] });
    setPrompt("");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }
  function importBoard(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      try {
        const data: unknown = JSON.parse(text);
        if (!data || typeof data !== "object" || !("format" in data) || data.format !== "air-nano-board" || !("cards" in data) || !Array.isArray(data.cards) || !("strokes" in data) || !Array.isArray(data.strokes)) throw Error("Invalid file");
        const safeCards = data.cards.filter((c): c is BoardCard => c && typeof c.id === "string" && typeof c.title === "string" && typeof c.body === "string" && typeof c.x === "number" && typeof c.y === "number" && ["note", "task", "heading"].includes(c.kind) && cardColors.includes(c.color));
        const safeStrokes = data.strokes.filter((s): s is BoardStroke => s && typeof s.id === "string" && Array.isArray(s.points) && s.points.every((p: { x: unknown; y: unknown }) => typeof p.x === "number" && typeof p.y === "number") && ["ink", "blue", "red"].includes(s.color) && typeof s.width === "number");
        const next = createThread();
        next.title = "title" in data && typeof data.title === "string" ? data.title.slice(0, 80) : "Imported board";
        next.cards = safeCards;
        next.strokes = safeStrokes;
        const all = [next, ...readThreads()];
        writeThreads(all); setThreads(all); setActiveThreadId(next.id); setSelected([]); setShowTemplates(false);
        void navigate({ to: "/$threadId", params: { threadId: next.id } });
        setNotice("Board imported");
      } catch { setNotice("This isn’t an Air Nano Board file."); }
      event.target.value = "";
    });
  }
  return (
    <main className="flex h-dvh w-full overflow-hidden bg-paper font-display text-ink">
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importBoard} />
      {showBoards && <div className="fixed inset-0 z-40 bg-ink/20 lg:hidden" onClick={() => setShowBoards(false)} />}
      <aside className={`${showBoards ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-border bg-card lg:relative lg:z-10 lg:flex`}>
        <div className="flex h-17 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-ink text-sm font-bold text-paper">A</span><span className="text-sm font-bold">Air Nano Board</span></div>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close boards" onClick={() => setShowBoards(false)}><X /></Button>
        </div>
        <div className="p-4"><Button variant="ink" className="w-full justify-start" onClick={() => setShowTemplates(true)}><Plus /> New board</Button></div>
        <div className="px-4"><div className="flex items-center gap-2 rounded-md border border-border bg-paper px-3"><Search className="size-4 text-cool" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a board" aria-label="Find a board" className="h-9 w-full min-w-0 bg-transparent text-sm outline-none" /></div></div>
        <p className="px-5 pt-7 pb-2 text-[11px] font-semibold uppercase text-cool">Your boards</p>
        <div className="flex-1 space-y-1 overflow-y-auto px-3">{threads.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())).map((item) => <Button key={item.id} variant="ghost" onClick={() => openBoard(item.id)} className={`w-full justify-start truncate px-3 text-sm ${item.id === activeThreadId ? "bg-note-blue text-ink" : "text-cool"}`}><Grid2X2 className="shrink-0" /><span className="truncate">{item.title}</span></Button>)}</div>
        <p className="border-t border-border p-4 text-xs leading-relaxed text-cool">Saved in this browser. Export a board to move it to another device.</p>
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-17 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open boards" onClick={() => setShowBoards(true)}><Menu /></Button><input aria-label="Board title" value={thread?.title ?? ""} onChange={(event) => save({ title: event.target.value })} className="min-w-0 max-w-56 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-cool sm:max-w-96" placeholder="Untitled board" /><span className="hidden text-xs text-cool sm:inline">Saved locally</span></div>
          <div className="flex items-center gap-1 sm:gap-2"><Button variant="ghost" size="icon" title="Import board" aria-label="Import board" onClick={() => fileRef.current?.click()}><ArrowUp /></Button><Button variant="ghost" size="icon" title="Export board" aria-label="Export board" onClick={() => thread && downloadBoard(thread)}><ArrowDownToLine /></Button><Button variant="glass" size="sm" onClick={() => setShowTemplates(true)} className="hidden sm:inline-flex"><Plus /> New board</Button><Button variant="glass" size="icon" onClick={() => setShowTemplates(true)} aria-label="New board" className="sm:hidden"><Plus /></Button></div>
        </header>
        <div ref={canvasRef} className={`relative flex-1 overflow-auto ${grid ? "board-grid" : "bg-paper"}`} onClick={(event) => { if (event.target === event.currentTarget) setSelected([]); }}>
          <div className="relative" style={{ width: `${Math.max(1400, ...cards.map((c) => c.x + 420)) * zoom / 100}px`, height: `${Math.max(900, ...cards.map((c) => c.y + 340)) * zoom / 100}px` }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: `${Math.max(1400, ...cards.map((c) => c.x + 420))}px`, height: `${Math.max(900, ...cards.map((c) => c.y + 340))}px`, transform: `scale(${zoom / 100})` }}>
              <svg className={`absolute inset-0 h-full w-full ${tool === "pen" ? "z-10 cursor-crosshair touch-none" : "pointer-events-none"}`} onPointerDown={startStroke} onPointerMove={(event) => { if (draftStroke) setDraftStroke({ ...draftStroke, points: [...draftStroke.points, canvasPoint(event)] }); }} onPointerUp={finishStroke} onPointerCancel={finishStroke} aria-label="Drawing canvas">
                {[...strokes, ...(draftStroke ? [draftStroke] : [])].map((stroke) => <polyline key={stroke.id} points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" className={inkClass[stroke.color]} />)}
              </svg>
              {cards.map((card) => <div key={card.id} onPointerDown={(event) => startDrag(event, card)} onPointerMove={(event) => moveDrag(event, card)} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onDoubleClick={() => { setSelected([card.id]); setTool("select"); }} style={{ left: card.x, top: card.y }} className={`absolute w-64 touch-none rounded-md border p-4 shadow-soft select-none ${cardClass[card.color]} ${selected.includes(card.id) ? "border-softblue ring-2 ring-softblue/30" : "border-glass-border"} ${tool === "select" ? "cursor-grab active:cursor-grabbing" : ""}`}>
                <div className="flex items-start gap-2">{card.kind === "task" && <Button variant="ghost" size="icon" aria-label={card.done ? "Mark incomplete" : "Mark complete"} title={card.done ? "Mark incomplete" : "Mark complete"} onClick={() => patchCard(card.id, { done: !card.done })} className="-ml-2 -mt-1 size-8 shrink-0">{card.done ? <CheckSquare2 className="text-softblue" /> : <Square />}</Button>}<div className="min-w-0 flex-1"><p className={`break-words font-semibold leading-snug ${card.kind === "heading" ? "text-xl" : "text-base"} ${card.done ? "text-cool line-through" : ""}`}>{card.title}</p>{card.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-cool">{card.body}</p>}</div></div>
              </div>)}
            </div>
          </div>
          {!cards.length && <div className="pointer-events-none sticky left-0 top-24 w-[min(100vw,100%)] text-center"><div className="pointer-events-auto mx-auto w-72"><div className="mx-auto grid size-12 place-items-center rounded-lg bg-note-blue"><Grid2X2 /></div><h1 className="mt-5 text-xl font-semibold">A place for your ideas</h1><p className="mt-2 text-sm text-cool">Add a note, a task, or start from a template.</p><Button variant="ink" className="mt-5" onClick={() => addCard("note")}><Plus /> Add a note</Button></div></div>}
        </div>
        {selected.length > 0 && tool === "select" && <div className="absolute bottom-24 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-md border border-border bg-card p-1.5 shadow-glass sm:bottom-25"><span className="hidden px-2 text-xs font-medium text-cool sm:inline">{selected.length} selected</span><Button variant="ghost" size="sm" title="Duplicate selection" onClick={duplicateSelected}><Copy /><span className="hidden sm:inline">Duplicate</span></Button><Button variant="ghost" size="sm" title="Turn into tasks" onClick={convertSelected}><CheckSquare2 /><span className="hidden sm:inline">Make tasks</span></Button><Button variant="ghost" size="icon" title="Delete selection" aria-label="Delete selection" onClick={removeSelected}><Trash2 /></Button><Button variant="ghost" size="icon" title="Clear selection" aria-label="Clear selection" onClick={() => setSelected([])}><X /></Button></div>}
        {selectedCard && tool === "select" && <aside className="absolute right-3 top-3 z-20 w-[min(19rem,calc(100vw-1.5rem))] border border-border bg-card p-4 shadow-glass sm:right-5 sm:top-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-semibold">Edit {selectedCard.kind}</h2><Button variant="ghost" size="icon" aria-label="Close editor" onClick={() => setSelected([])}><X /></Button></div><label className="text-xs font-medium text-cool">Title<input value={selectedCard.title} onChange={(event) => patchCard(selectedCard.id, { title: event.target.value })} className="mt-1.5 mb-4 block h-10 w-full rounded-md border border-border bg-paper px-3 text-sm text-ink outline-none focus:border-softblue" /></label><label className="text-xs font-medium text-cool">Details<Textarea value={selectedCard.body} onChange={(event) => patchCard(selectedCard.id, { body: event.target.value })} className="mt-1.5 min-h-28 resize-y bg-paper text-ink" placeholder="Add details…" /></label><p className="mt-5 mb-2 text-xs font-medium text-cool">Color</p><div className="flex gap-2">{cardColors.map((color) => <Button key={color} variant="ghost" size="icon" title={color} aria-label={`${color} card`} onClick={() => patchCard(selectedCard.id, { color })} className={`size-8 rounded-full border ${cardClass[color]} ${selectedCard.color === color ? "ring-2 ring-softblue" : "border-border"}`}>{selectedCard.color === color && <Check className="size-3" />}</Button>)}</div></aside>}
        {tool === "chat" && <aside className="absolute bottom-24 right-3 top-3 z-30 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col border border-border bg-card p-4 shadow-glass sm:right-5 sm:top-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Board assistant</h2><p className="text-xs text-cool">Works with your board content · offline</p></div><Button variant="ghost" size="icon" aria-label="Close assistant" onClick={() => setTool("select")}><X /></Button></div><div className="mt-4 flex gap-1.5"><Button variant="outline" size="sm" onClick={() => setPrompt("Summarize this board")}>Summarize</Button><Button variant="outline" size="sm" onClick={() => setPrompt("Create an action list")}>Action list</Button></div><div className="mt-4 flex-1 space-y-4 overflow-y-auto">{!thread?.messages.length && <p className="text-sm leading-relaxed text-cool">Ask for a summary, an action list, or the progress of your tasks. Select cards first to focus on them.</p>}{thread?.messages.map((message) => <div key={message.id} className={`max-w-[90%] whitespace-pre-wrap rounded-md p-3 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-ink text-paper" : "bg-paper text-ink"}`}>{message.parts.map((part) => part.text).join("")}</div>)}</div><div className="mt-4 border border-border bg-paper p-2"><Textarea ref={textareaRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendPrompt(); } }} placeholder="Ask about this board…" className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" /><div className="flex justify-end"><Button variant="ink" size="icon" aria-label="Send message" onClick={sendPrompt} disabled={!prompt.trim()}><ArrowUp /></Button></div></div></aside>}
        {tool === "settings" && <aside className="absolute right-3 top-3 z-30 w-[min(19rem,calc(100vw-1.5rem))] border border-border bg-card p-4 shadow-glass sm:right-5 sm:top-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Board settings</h2><Button variant="ghost" size="icon" aria-label="Close settings" onClick={() => setTool("select")}><X /></Button></div><label className="mt-6 flex items-center justify-between text-sm">Show grid<input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} className="accent-softblue" /></label><div className="mt-6 border-t border-border pt-5"><p className="text-xs font-semibold uppercase text-cool">Working with boards</p><p className="mt-3 text-sm leading-relaxed text-cool">Add notes, headings, and tasks from the toolbar. Drag items to arrange them. Shift-click to select multiple items. Select all to update them together. Use the pen to sketch directly on the board.</p></div><div className="mt-6 border-t border-border pt-5"><p className="text-xs font-semibold uppercase text-cool">Your data</p><p className="mt-3 text-sm leading-relaxed text-cool">Boards are stored on this device only. Export a file to back up or transfer a board. Links do not share board content.</p><Button variant="outline" size="sm" className="mt-4 w-full" onClick={deleteBoard}><Trash2 /> Delete this board</Button></div></aside>}
        {tool === "pen" && <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border border-border bg-card p-1.5 shadow-soft"><span className="px-2 text-xs text-cool">Ink</span>{(["ink", "blue", "red"] as const).map((color) => <Button key={color} variant="ghost" size="icon" aria-label={`${color} ink`} title={`${color} ink`} onClick={() => setInk(color)} className={`size-8 rounded-full ${ink === color ? "ring-2 ring-softblue" : ""}`}><span className={`size-4 rounded-full ${inkSwatch[color]}`} /></Button>)}<span className="mx-1 h-5 w-px bg-border" /><Button variant="ghost" size="icon" aria-label="Undo last stroke" title="Undo last stroke" disabled={!strokes.length} onClick={() => save({ strokes: strokes.slice(0, -1) })}><RotateCcw /></Button></div>}
        <div className="absolute bottom-5 left-4 z-20 hidden items-center gap-1 rounded-md border border-border bg-card p-1 shadow-soft sm:flex"><Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(50, v - 10))}><ZoomOut /></Button><span className="w-12 text-center text-xs">{zoom}%</span><Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(150, v + 10))}><ZoomIn /></Button></div>
        <nav aria-label="Board tools" className="absolute bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-xl border border-glass-border bg-glass-strong p-1.5 shadow-glass backdrop-blur-xl sm:gap-1">
          <Button variant="ghost" size="sm" aria-label="Add note" title="Add note" onClick={() => addCard("note")} className="h-11 px-2 sm:px-3"><Plus /><span className="hidden sm:inline">Note</span></Button><Button variant="ghost" size="sm" aria-label="Add task" title="Add task" onClick={() => addCard("task")} className="h-11 px-2 sm:px-3"><CheckSquare2 /><span className="hidden sm:inline">Task</span></Button><Button variant="ghost" size="sm" aria-label="Add heading" title="Add heading" onClick={() => addCard("heading")} className="h-11 px-2 sm:px-3"><span className="font-bold">T</span><span className="hidden sm:inline">Heading</span></Button><span className="mx-1 h-6 w-px bg-border" />{([ ["select", MousePointer2, "Select"], ["pen", PenLine, "Pen"], ["chat", MessageCircle, "Assistant"], ["settings", Settings2, "Settings"] ] as const).map(([id, Icon, label]) => <Button key={id} variant={tool === id ? "ink" : "ghost"} size="sm" onClick={() => setTool(id)} aria-label={label} title={label} className="h-11 px-2 sm:px-3"><Icon /><span className="hidden sm:inline">{label}</span></Button>)}<span className="mx-1 hidden h-6 w-px bg-border sm:block" /><Button variant="ghost" size="icon" aria-label="Select all cards" title="Select all cards" onClick={() => { setTool("select"); setSelected(cards.map((card) => card.id)); }} className="hidden sm:inline-flex"><CheckSquare2 /></Button>
        </nav>
        {notice && <div role="status" className="absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2 text-xs text-paper">{notice}</div>}
        {showTemplates && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={() => setShowTemplates(false)}><div role="dialog" aria-modal="true" aria-label="Create a board" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-glass"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Create a board</h2><Button variant="ghost" size="icon" aria-label="Close" onClick={() => setShowTemplates(false)}><X /></Button></div><div className="mt-5 grid grid-cols-2 gap-2">{templates.map(({ id, label, icon: Icon }) => <Button key={id} variant="outline" onClick={() => createBoard(id)} className="h-22 flex-col items-start gap-3 whitespace-normal p-3 text-left"><Icon /><span>{label}</span></Button>)}</div><Button variant="ghost" className="mt-4 w-full" onClick={() => { setShowTemplates(false); fileRef.current?.click(); }}><ArrowUp /> Import a board</Button></div></div>}
      </div>
    </main>
  );
}
