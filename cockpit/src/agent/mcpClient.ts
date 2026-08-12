import { experimental_createMCPClient as createMCPClient } from 'ai';

type McpClient = Awaited<ReturnType<typeof createMCPClient>>;

let clientPromise: Promise<McpClient> | null = null;

// Tools that bypass the visible desktop entirely (direct exec / direct file I/O).
// Excluded from the agent's toolset so every action happens through mouse/keyboard/
// application input that is actually visible live in the noVNC feed.
const HIDDEN_TOOLS = new Set(['computer_bash', 'computer_read_file', 'computer_write_file']);

export function getMcpClient(): Promise<McpClient> {
  if (!clientPromise) {
    clientPromise = createMCPClient({
      transport: {
        type: 'sse',
        url: process.env.MCP_URL || 'http://iagencia-desktop:9990/mcp',
      },
    });
  }
  return clientPromise;
}

export async function getMcpTools() {
  const client = await getMcpClient();
  const allTools = await client.tools();
  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => !HIDDEN_TOOLS.has(name)),
  ) as typeof allTools;
}
