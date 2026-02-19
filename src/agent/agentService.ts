import Anthropic from '@anthropic-ai/sdk';
import { executeSqlTool } from './tools';
import { buildSystemPrompt } from './systemPrompt';
import type { TableInfo, ToolCallResult } from '../types';

interface AgentCallbacks {
  onTextChunk: (text: string) => void;
  onToolCall: (toolCallId: string, sql: string) => void;
  onToolResult: (result: ToolCallResult) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlockParam[];
}

const MAX_RESULT_ROWS = 100;

export async function runAgentLoop(
  apiKey: string,
  messages: ConversationMessage[],
  tables: TableInfo[],
  executeSql: (sql: string) => Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }>,
  callbacks: AgentCallbacks,
  signal?: AbortSignal,
) {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const systemPrompt = buildSystemPrompt(tables);
  let currentMessages = [...messages];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) return;

    let fullText = '';
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    let stopReason: string | null = null;

    try {
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: [executeSqlTool],
        messages: currentMessages as Anthropic.MessageParam[],
      });

      for await (const event of stream) {
        if (signal?.aborted) return;

        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            callbacks.onTextChunk(event.delta.text);
          }
        } else if (event.type === 'content_block_stop') {
          // Check accumulated content blocks from the stream
        } else if (event.type === 'message_stop') {
          // done
        }
      }

      const finalMessage = await stream.finalMessage();
      stopReason = finalMessage.stop_reason;

      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          toolUseBlocks.push(block);
        }
      }
    } catch (e: unknown) {
      if (signal?.aborted) return;
      const msg = e instanceof Error ? e.message : 'API call failed';
      callbacks.onError(msg);
      return;
    }

    if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
      // Build assistant message content
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (fullText) {
        assistantContent.push({ type: 'text', text: fullText });
      }
      for (const tool of toolUseBlocks) {
        assistantContent.push({
          type: 'tool_use',
          id: tool.id,
          name: tool.name,
          input: tool.input,
        });
      }

      currentMessages.push({ role: 'assistant', content: assistantContent });

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUseBlocks) {
        const sql = (tool.input as { sql: string }).sql;
        callbacks.onToolCall(tool.id, sql);

        try {
          const result = await executeSql(sql);
          const truncatedRows = result.rows.slice(0, MAX_RESULT_ROWS);
          const toolResult: ToolCallResult = {
            toolCallId: tool.id,
            sql,
            columns: result.columns,
            rows: truncatedRows,
            rowCount: result.rowCount,
          };
          callbacks.onToolResult(toolResult);

          let content = JSON.stringify({ columns: result.columns, rows: truncatedRows, totalRows: result.rowCount });
          if (result.rowCount > MAX_RESULT_ROWS) {
            content += `\n(Showing first ${MAX_RESULT_ROWS} of ${result.rowCount} rows)`;
          }
          toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content });
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : 'SQL execution failed';
          const toolResult: ToolCallResult = {
            toolCallId: tool.id,
            sql,
            columns: [],
            rows: [],
            rowCount: 0,
            error: errMsg,
          };
          callbacks.onToolResult(toolResult);
          toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: `Error: ${errMsg}`, is_error: true });
        }
      }

      currentMessages.push({ role: 'user', content: toolResults });
    } else {
      // End turn — no more tool calls
      callbacks.onDone();
      return;
    }
  }
}
