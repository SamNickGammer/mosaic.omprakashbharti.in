"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClients, type ClientTreeNode } from "@/hooks/queries";
import { useWorkspace } from "@/stores/workspace";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Logo } from "@/components/brand/logo";

export function Sidebar() {
  const { data: clients, isLoading } = useClients();
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" aria-label="Mosaic home">
          <Logo width={116} />
        </Link>
      </div>

      <nav className="px-2 py-3">
        <SidebarLink
          href="/"
          active={pathname === "/"}
          icon={<LayoutDashboard className="size-4" />}
          label="Dashboard"
        />
      </nav>

      <div className="flex items-center justify-between px-4 pb-1 pt-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Clients
        </span>
        <CreateClientDialog
          trigger={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New client"
              className="text-muted-foreground"
            >
              <Plus className="size-4" />
            </Button>
          }
        />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2">
        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : !clients || clients.length === 0 ? (
          <EmptyClients />
        ) : (
          <ul className="space-y-0.5 pb-4">
            {clients.map((client) => (
              <ClientNode
                key={client.id}
                client={client}
                pathname={pathname}
              />
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="border-t p-2">
        <SidebarLink
          href="/settings/agents"
          active={pathname.startsWith("/settings")}
          icon={<Settings className="size-4" />}
          label="Settings"
        />
      </div>
    </aside>
  );
}

function ClientNode({
  client,
  pathname,
}: {
  client: ClientTreeNode;
  pathname: string;
}) {
  const activeProjectId = useWorkspace((s) => s.activeProjectId);
  const setActiveClient = useWorkspace((s) => s.setActiveClient);
  const clientIsActive = pathname.includes(`/clients/${client.id}/`);
  const [open, setOpen] = useState(clientIsActive);

  useEffect(() => {
    if (clientIsActive) setOpen(true);
  }, [clientIsActive]);

  return (
    <li>
      <div className="group flex items-center">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setActiveClient(client.id);
          }}
          className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent"
        >
          {open ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: client.color ?? "var(--primary)" }}
          />
          <span className="truncate">{client.name}</span>
        </button>
        <CreateProjectDialog
          clientId={client.id}
          clientName={client.name}
          trigger={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`New project in ${client.name}`}
              className="mr-1 text-muted-foreground opacity-0 group-hover:opacity-100"
            >
              <Plus className="size-3.5" />
            </Button>
          }
        />
      </div>

      {open && (
        <ul className="ml-4 space-y-0.5 border-l pl-2">
          {client.projects.length === 0 ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">
              No projects yet
            </li>
          ) : (
            client.projects.map((project) => {
              const href = `/clients/${client.id}/projects/${project.id}`;
              const isActive =
                pathname.startsWith(href) || activeProjectId === project.id;
              return (
                <li key={project.id}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent",
                      isActive &&
                        "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                  >
                    <FolderKanban className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      )}
    </li>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function EmptyClients() {
  return (
    <div className="rounded-lg border border-dashed p-4 text-center">
      <p className="text-sm font-medium">No clients yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Create your first client to get started.
      </p>
      <CreateClientDialog
        trigger={
          <Button size="sm" className="mt-3 w-full">
            <Plus className="size-4" /> New client
          </Button>
        }
      />
    </div>
  );
}
