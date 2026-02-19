import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DuckDBContext } from './DuckDBContext';
import { runAgentLoop } from './agent/agentService';
import type { ChatMessage, ContentSegment, TableInfo, ToolCallResult } from './types';
import type Anthropic from '@anthropic-ai/sdk';

interface AgentContextValue {
  messages: ChatMessage[];
  isStreaming: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  sendMessage: (text: string) => void;
  clearMessages: () => void;
}

const AgentContext = createContext<AgentContextValue>({
  messages: [],
  isStreaming: false,
  apiKey: '',
  setApiKey: () => {},
  sendMessage: () => {},
  clearMessages: () => {},
});

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function AgentProvider({
  children,
  tables,
  refreshTables,
}: {
  children: ReactNode;
  tables: TableInfo[];
  refreshTables: () => Promise<void>;
}) {
  const { conn } = useContext(DuckDBContext);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const textBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantIdRef = useRef('');
  const segmentsRef = useRef<ContentSegment[]>([]);
  const currentTextRef = useRef('');

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
  }, []);

  const flushText = useCallback(() => {
    const text = textBufferRef.current;
    if (!text) return;
    const id = assistantIdRef.current;
    currentTextRef.current += text;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m
      )
    );
    textBufferRef.current = '';
  }, []);

  const executeSql = useCallback(
    async (sql: string) => {
      if (!conn) throw new Error('DuckDB not connected');
      const result = await conn.query(sql);
      const rows = result.toArray().map((row) => row.toJSON());
      const columns = result.schema.fields.map((f) => f.name);
      return { columns, rows, rowCount: rows.length };
    },
    [conn]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!apiKey || isStreaming || !conn) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
      };

      const assistantId = generateId();
      assistantIdRef.current = assistantId;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      textBufferRef.current = '';
      segmentsRef.current = [];
      currentTextRef.current = '';

      // Build conversation history for the API
      const conversationMessages: {
        role: 'user' | 'assistant';
        content: string | Anthropic.ContentBlockParam[];
      }[] = [];

      for (const msg of [...messages, userMsg]) {
        if (msg.role === 'user') {
          conversationMessages.push({ role: 'user', content: msg.content });
        } else {
          conversationMessages.push({ role: 'assistant', content: msg.content });
        }
      }

      const controller = new AbortController();
      abortRef.current = controller;

      await runAgentLoop(
        apiKey,
        conversationMessages,
        tables,
        executeSql,
        {
          onTextChunk: (chunk) => {
            textBufferRef.current += chunk;
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                flushText();
                flushTimerRef.current = null;
              }, 50);
            }
          },
          onToolCall: () => {
            // Flush any buffered text before tool call
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            flushText();
            // Save accumulated text as a thinking segment
            if (currentTextRef.current.trim()) {
              segmentsRef.current.push({ type: 'thinking', text: currentTextRef.current });
              currentTextRef.current = '';
            }
          },
          onToolResult: (result: ToolCallResult) => {
            segmentsRef.current.push({ type: 'tool', toolResult: result });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, toolCalls: [...(m.toolCalls || []), result], segments: [...segmentsRef.current] }
                  : m
              )
            );
            refreshTables();
          },
          onDone: () => {
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            flushText();
            // Finalize remaining text as answer (if there were tool calls) or leave as-is
            if (currentTextRef.current.trim()) {
              const hasToolCalls = segmentsRef.current.some((s) => s.type === 'tool');
              segmentsRef.current.push({
                type: hasToolCalls ? 'answer' : 'answer',
                text: currentTextRef.current,
              });
              currentTextRef.current = '';
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, isStreaming: false, segments: [...segmentsRef.current] }
                  : m
              )
            );
            setIsStreaming(false);
            abortRef.current = null;
          },
          onError: (error) => {
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            flushText();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + `\n\n**Error:** ${error}`, isStreaming: false }
                  : m
              )
            );
            setIsStreaming(false);
            abortRef.current = null;
          },
        },
        controller.signal
      );
    },
    [apiKey, isStreaming, conn, messages, tables, executeSql, flushText, refreshTables]
  );

  const clearMessages = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return (
    <AgentContext.Provider
      value={{ messages, isStreaming, apiKey, setApiKey, sendMessage, clearMessages }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  return useContext(AgentContext);
}
