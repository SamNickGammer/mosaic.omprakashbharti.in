"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES } from "@/types";
import type { TaskPriority, TaskStatus } from "@/types";
import { useCreateTask } from "@/hooks/queries";
import { useControllableOpen } from "@/hooks/use-controllable-open";

export function CreateTaskDialog({
  projectId,
  defaultStatus = "backlog",
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
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setInstructions("");
    setPriority("medium");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required");
    try {
      await create.mutateAsync({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        priority,
        status: defaultStatus,
      });
      reset();
      setOpen(false);
    } catch (err) {
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              Describe the work. Agents will pick it up from here in later
              phases.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Refactor auth middleware"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-instructions">Instructions</Label>
              <Textarea
                id="task-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Extract the token-verify step, keep /v1 routes untouched…"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: unknown) =>
                      TASK_PRIORITIES.find((p) => p.id === value)?.label ??
                      "Medium"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
