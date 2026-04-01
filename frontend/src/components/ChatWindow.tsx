import { Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportConversation } from "../lib/api";
import type { ContextSnippet, Message } from "../types";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageBubble, StreamingBubble } from "./MessageBubble";

interface ChatWindowProps {
	messages: Message[];
	loading: boolean;
	error: string | null;
	streaming: boolean;
	streamingContent: string;
	hasDocument: boolean;
	conversationId: string | null;
	contextSnippets: ContextSnippet[];
	onSend: (content: string) => void;
	onUpload: (file: File) => void;
	onRemoveContext: (id: string) => void;
	onClearContext: () => void;
}

export function ChatWindow({
	messages,
	loading,
	error,
	streaming,
	streamingContent,
	hasDocument,
	conversationId,
	contextSnippets,
	onSend,
	onUpload,
	onRemoveContext,
	onClearContext,
}: ChatWindowProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);

	// Auto-scroll to bottom when new messages arrive or during streaming
	const messagesLength = messages.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages and streamingContent are intentional triggers for auto-scroll
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messagesLength, streamingContent]);

	const exportErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const handleExport = useCallback(async () => {
		if (!conversationId || exporting) return;
		if (exportErrorTimerRef.current) {
			clearTimeout(exportErrorTimerRef.current);
			exportErrorTimerRef.current = null;
		}
		try {
			setExporting(true);
			setExportError(null);
			await exportConversation(conversationId);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Export failed";
			setExportError(msg);
			exportErrorTimerRef.current = setTimeout(() => {
				setExportError(null);
				exportErrorTimerRef.current = null;
			}, 5000);
		} finally {
			setExporting(false);
		}
	}, [conversationId, exporting]);

	// No conversation selected
	if (!conversationId) {
		return (
			<div className="flex flex-1 items-center justify-center bg-neutral-50">
				<div className="text-center">
					<p className="text-sm text-neutral-400">
						Select a conversation or create a new one
					</p>
				</div>
			</div>
		);
	}

	// Loading messages
	if (loading) {
		return (
			<div className="flex flex-1 items-center justify-center bg-white">
				<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
			</div>
		);
	}

	// Empty conversation - show upload prompt
	if (messages.length === 0 && !streaming) {
		return (
			<div className="flex flex-1 flex-col bg-white">
				<div className="flex flex-1 items-center justify-center">
					{hasDocument ? (
						<div className="text-center">
							<p className="text-sm text-neutral-500">
								Document uploaded. Ask a question to get started.
							</p>
						</div>
					) : (
						<EmptyState onUpload={onUpload} />
					)}
				</div>
				<ChatInput
					onSend={onSend}
					onUpload={onUpload}
					disabled={streaming}
					contextSnippets={contextSnippets}
					onRemoveContext={onRemoveContext}
					onClearContext={onClearContext}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col bg-white">
			{/* Toolbar */}
			<div className="flex items-center justify-end border-b border-neutral-100 px-4 py-1.5">
				{exportError && (
					<p className="mr-3 text-xs text-red-500">{exportError}</p>
				)}
				<button
					type="button"
					onClick={handleExport}
					disabled={exporting || streaming}
					className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
					title="Export conversation to Word"
				>
					{exporting ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Download className="h-3.5 w-3.5" />
					)}
					{exportError ? "Retry" : "Export"}
				</button>
			</div>

			{error && (
				<div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
					{error}
				</div>
			)}

			<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
				<div className="mx-auto max-w-2xl space-y-1">
					{messages.map((message) => (
						<MessageBubble key={message.id} message={message} />
					))}
					{streaming && <StreamingBubble content={streamingContent} />}
				</div>
			</div>

			<ChatInput
				onSend={onSend}
				onUpload={onUpload}
				disabled={streaming}
				contextSnippets={contextSnippets}
				onRemoveContext={onRemoveContext}
				onClearContext={onClearContext}
			/>
		</div>
	);
}
