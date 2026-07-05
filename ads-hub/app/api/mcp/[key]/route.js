/**
 * Path-keyed MCP endpoint: /api/mcp/<personal-key> (D-17).
 * Exists because claude.ai's connector client strips the query string on tool calls,
 * so ?key= auth dies after registration. The parent handler reads the key from the
 * path (see memberForRequest) — this file just routes the segment to it.
 */
export { POST, GET, DELETE } from "../route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
