export interface Skill {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  enabled: boolean;
  createdAt: number;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  agentTrace?: AgentTrace[];
}

export interface AgentTrace {
  agent: string;
  action: string;
  detail?: string;
}

export type WsEvent =
  | { type: "chat_start"; messageId: string }
  | { type: "chat_delta"; messageId: string; delta: string }
  | { type: "chat_done"; messageId: string; fullText: string }
  | { type: "agent_trace"; messageId: string; trace: AgentTrace }
  | { type: "error"; messageId: string; error: string };
