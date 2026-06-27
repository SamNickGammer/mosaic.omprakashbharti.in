"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/queries";
import { useWorkspace } from "@/stores/workspace";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";
import { UserMenu } from "@/components/layout/user-menu";

interface TopbarProps {
  user: { name: string | null; email: string | null; image: string | null };
}

export function Topbar({ user }: TopbarProps) {
  const { data: clients } = useClients();
  const activeClientId = useWorkspace((s) => s.activeClientId);
  const setActiveClient = useWorkspace((s) => s.setActiveClient);
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const activeClient = clients?.find((c) => c.id === activeClientId) ?? null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-2">
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor: activeClient?.color ?? "var(--primary)",
                }}
              />
              <span className="max-w-40 truncate">
                {activeClient?.name ?? "Select client"}
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Clients</DropdownMenuLabel>
          {clients && clients.length > 0 ? (
            clients.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => {
                  setActiveClient(c.id);
                  const first = c.projects[0];
                  if (first) {
                    router.push(`/clients/${c.id}/projects/${first.id}`);
                  }
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: c.color ?? "var(--primary)" }}
                />
                <span className="flex-1 truncate">{c.name}</span>
                <Check
                  className={cn(
                    "size-4",
                    activeClientId === c.id ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No clients yet</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} />

      <UserMenu user={user} />
    </header>
  );
}
