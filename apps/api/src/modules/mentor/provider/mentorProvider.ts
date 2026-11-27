export type MentorChatRole = 'user' | 'assistant';

export type MentorChatMessage = {
  role: MentorChatRole;
  content: string;
};

export type MentorToolDefinition = {
  /** ^[a-zA-Z0-9_-]+$ */
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MentorToolCall = {
  name: string;
  input: unknown;
};

export type MentorToolResult = {
  content: string;
  isError?: boolean;
};

export type MentorProviderRequest = {
  system: string;
  messages: MentorChatMessage[];
  maxOutputTokens: number;
  signal: AbortSignal;
  /** Tools the model may call. The provider runs the tool loop itself. */
  tools?: MentorToolDefinition[];
  onToolCall?: (call: MentorToolCall) => Promise<MentorToolResult>;
  /** Maximum model round trips caused by tool calls (default 0 = no tools). */
  maxToolRounds?: number;
};

export type MentorProviderResponse = {
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  truncated: boolean;
};

/**
 * Boundary between Grow and any LLM vendor. Implementations must:
 * - never log message content,
 * - honour the abort signal,
 * - throw MentorProviderError for vendor failures.
 */
export type MentorProvider = {
  readonly name: string;
  generateReply(request: MentorProviderRequest): Promise<MentorProviderResponse>;
};

export type MentorProviderErrorKind = 'unavailable' | 'rate_limited' | 'timeout' | 'invalid_response';

export class MentorProviderError extends Error {
  readonly kind: MentorProviderErrorKind;

  constructor(kind: MentorProviderErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MentorProviderError';
    this.kind = kind;
  }
}
