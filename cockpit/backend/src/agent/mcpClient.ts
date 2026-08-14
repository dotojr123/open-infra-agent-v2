import { experimental_createMCPClient as createMCPClient } from 'ai';

type McpClient = Awaited<ReturnType<typeof createMCPClient>>;

let clientPromise: Promise<McpClient> | null = null;

/**
 * Ferramentas ocultadas do agente de propósito.
 * Bash, read_file e write_file executam "por baixo dos panos", sem aparecer na tela.
 * O objetivo do Cockpit é que TODA ação seja visível no noVNC.
 * Se o agente quer rodar um comando, ele deve abrir o Terminal visível.
 */
const HIDDEN_TOOLS = new Set([
  'computer_bash_execute',
  'computer_read_file',
  'computer_write_file',
]);

export function getMcpClient(): Promise<McpClient> {
  if (!clientPromise) {
    const mcpUrl = process.env.MCP_URL || 'http://iagencia-desktop:9990/mcp';
    console.log(`[mcp] Conectando ao MCP em ${mcpUrl}`);
    clientPromise = createMCPClient({
      transport: {
        type: 'sse',
        url: mcpUrl,
      },
    });
  }
  return clientPromise;
}

export async function getMcpTools() {
  const client = await getMcpClient();
  const allTools = await client.tools();
  const filtered = Object.fromEntries(
    Object.entries(allTools).filter(([name]) => !HIDDEN_TOOLS.has(name)),
  ) as typeof allTools;
  console.log(
    `[mcp] ${Object.keys(allTools).length} tools disponíveis, ${Object.keys(filtered).length} expostas ao agente`,
  );
  return filtered;
}
