import { listParticipants } from "@/lib/room";
import { verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participants = await listParticipants(session.projectId);
  const self = participants.find((p) => p.id === session.id) ?? {
    id: session.id,
    name: session.name,
    agentType: session.agentType,
    status: session.status,
    isDefault: session.isDefault,
  };

  return Response.json({
    self: {
      id: self.id,
      name: self.name,
      agentType: self.agentType,
      isDefault: self.isDefault,
    },
    participants: participants
      .filter((p) => p.id !== session.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        agentType: p.agentType,
        status: p.status,
        isDefault: p.isDefault,
      })),
  });
}
