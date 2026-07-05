"use client";

import Link from "next/link";
import { Bookmark, BookmarkX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/board/badges";
import { relativeTime } from "@/lib/time";
import { useReview, useUnbookmark } from "@/hooks/queries";

export function ReviewManager() {
  const { data: tasks, isLoading } = useReview();
  const unbookmark = useUnbookmark();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="text-sm text-muted-foreground">
          Tasks you bookmarked for review, across every client.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Bookmark className="size-6 text-muted-foreground" />
            <p className="font-medium">Nothing bookmarked</p>
            <p className="text-sm text-muted-foreground">
              Use “Bookmark for review” on a task and it shows up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id}>
              <Card>
                <CardContent className="flex items-start gap-3 py-4">
                  <Bookmark className="mt-0.5 size-4 shrink-0 fill-amber-500 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/clients/${t.clientId}/projects/${t.projectId}/tasks/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <StatusBadge status={t.status} />
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor: t.clientColor ?? "var(--primary)",
                          }}
                        />
                        {t.clientName} · {t.projectName}
                      </span>
                      <span>Updated {relativeTime(t.updatedAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove bookmark"
                    disabled={unbookmark.isPending}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => unbookmark.mutate(t.id)}
                  >
                    <BookmarkX className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
