import { voiceRoutes } from "../../../../lib/voice/server";

export const dynamic = "force-dynamic";

/** An agent rings a team test phone (TELL_TEAM_PHONES only). */
export const POST = (req: Request) => voiceRoutes().call(req);
