"use client";

import { useRef, useState, type ReactElement } from "react";
import { Bookmark, Loader2, Paperclip, Pause, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";
import { useCreateTask } from "@/hooks/queries";
import { useControllableOpen } from "@/hooks/use-controllable-open";

const MAX_INSTRUCTIONS = 160_000;
type BeforeStart = "none" | "compact" | "clear";

export function CreateTaskDialog({
  projectId,
  defaultStatus = "in_progress",
  trigger,
  open: openProp,
  onOpenChange,
}: {
  projectId: string;
  defaultStatus?: TaskStatus;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { open, setOpen } = useControllableOpen(openProp, onOpenChange);
  const create = useCreateTask(projectId);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [parked, setParked] = useState(defaultStatus === "backlog");
  const [before, setBefore] = useState<BeforeStart>("none");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setInstructions("");
    setBookmarked(false);
    setParked(defaultStatus === "backlog");
    setBefore("none");
    setFiles([]);
    setUploading(false);
    setError(null);
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list).filter((f) => f.size <= 50 * 1024 * 1024);
    setFiles((prev) => [...prev, ...incoming]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required");
    // Parked → held in backlog; otherwise it goes straight to the agent queue
    // (or stays in whatever column it was created from).
    const status: TaskStatus = parked
      ? "backlog"
      : defaultStatus === "backlog"
        ? "in_progress"
        : defaultStatus;
    try {
      const res = await create.mutateAsync({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        status,
        bookmarked,
        compactBefore: before === "compact",
        clearBefore: before === "clear",
      });
      // Files upload right after the task is saved.
      const taskId = (res as { task?: { id?: string } })?.task?.id;
      if (taskId && files.length > 0) {
        setUploading(true);
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          const up = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: "POST",
            body: fd,
          });
          if (!up.ok) {
            const body = await up.json().catch(() => ({}));
            throw new Error(
              (body as { error?: string }).error ??
                `Upload failed for ${file.name}`,
            );
          }
        }
      }
      reset();
      setOpen(false);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void onSubmit(e);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary shown on the card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-instructions">
                Instructions{" "}
                <span className="font-normal text-muted-foreground">
                  — this is exactly what a connected agent receives as its task
                </span>
              </Label>
              <Textarea
                id="task-instructions"
                value={instructions}
                onChange={(e) =>
                  setInstructions(e.target.value.slice(0, MAX_INSTRUCTIONS))
                }
                placeholder="What should get done? Be specific — repo, branch, acceptance criteria, links. The agent reads this verbatim and works it autonomously."
                rows={6}
              />
              <p className="text-right text-xs text-muted-foreground">
                {instructions.length.toLocaleString()} /{" "}
                {MAX_INSTRUCTIONS.toLocaleString()} · ⌘+Enter to save
              </p>
            </div>

            {/* Attach files — uploaded to blob storage right after Save. */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Paperclip className="size-4" /> Attach files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    fileInputRef.current?.click();
                }}
                onPaste={(e) => addFiles(e.clipboardData.files)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className="cursor-pointer rounded-xl border border-dashed bg-muted/30 p-4 text-center outline-none transition-colors hover:border-ring focus-visible:border-ring"
              >
                <p className="text-sm font-medium">
                  Drop, paste (⌘V), or click to upload
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to 50&nbsp;MB each. They upload right after Save; kept 7 days
                  while the task is open.
                </p>
              </div>
              {files.length > 0 ? (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Mark for follow-up</span>
              <button
                type="button"
                onClick={() => setBookmarked((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                  bookmarked
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-500"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <Bookmark
                  className={cn("size-4", bookmarked && "fill-current")}
                />
                Bookmark for review
              </button>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={parked}
                onChange={(e) => setParked(e.target.checked)}
                className="size-4 accent-primary"
              />
              <Pause className="size-4 shrink-0" />
              <span>
                <span className="font-medium">Park it</span>{" "}
                <span className="text-muted-foreground">
                  — by default the task goes straight to the agent queue
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Before agent starts</span>
              <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-sm">
                {(
                  [
                    ["none", "Run as-is"],
                    ["compact", "/compact"],
                    ["clear", "/clear"],
                  ] as [BeforeStart, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBefore(val)}
                    className={cn(
                      "rounded-full px-3 py-1 transition-colors",
                      before === val
                        ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-primary/40"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Uploading…
                </>
              ) : create.isPending ? (
                "Adding…"
              ) : (
                "Add task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
