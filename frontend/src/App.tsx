import { useCallback, useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DocumentViewer } from "./components/DocumentViewer";
import { TooltipProvider } from "./components/ui/tooltip";
import { useConversations } from "./hooks/use-conversations";
import { useDocument } from "./hooks/use-document";
import { useMessages } from "./hooks/use-messages";
import type { ContextSnippet } from "./types";

export default function App() {
	const {
		conversations,
		selectedId,
		loading: conversationsLoading,
		create,
		select,
		remove,
		refresh: refreshConversations,
	} = useConversations();

	const {
		messages,
		loading: messagesLoading,
		error: messagesError,
		streaming,
		streamingContent,
		send,
	} = useMessages(selectedId);

	const {
		documents,
		upload,
		remove: removeDocument,
		refresh: refreshDocument,
	} = useDocument(selectedId);

	const [contextSnippets, setContextSnippets] = useState<ContextSnippet[]>([]);

	const handleAddContext = useCallback(
		(snippet: Omit<ContextSnippet, "id">) => {
			setContextSnippets((prev) => [
				...prev,
				{ ...snippet, id: crypto.randomUUID() },
			]);
		},
		[],
	);

	const handleRemoveContext = useCallback((id: string) => {
		setContextSnippets((prev) => prev.filter((s) => s.id !== id));
	}, []);

	const handleClearContext = useCallback(() => {
		setContextSnippets([]);
	}, []);

	const handleSend = useCallback(
		async (content: string) => {
			await send(content);
			refreshConversations();
		},
		[send, refreshConversations],
	);

	const handleUpload = useCallback(
		async (file: File) => {
			const doc = await upload(file);
			if (doc) {
				refreshDocument();
				refreshConversations();
			}
		},
		[upload, refreshDocument, refreshConversations],
	);

	const handleCreate = useCallback(async () => {
		await create();
		setContextSnippets([]);
	}, [create]);

	const handleSelect = useCallback(
		(id: string) => {
			select(id);
			setContextSnippets([]);
		},
		[select],
	);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex h-screen bg-neutral-50">
				<ChatSidebar
					conversations={conversations}
					selectedId={selectedId}
					loading={conversationsLoading}
					onSelect={handleSelect}
					onCreate={handleCreate}
					onDelete={remove}
				/>

				<ChatWindow
					messages={messages}
					loading={messagesLoading}
					error={messagesError}
					streaming={streaming}
					streamingContent={streamingContent}
					hasDocument={documents.length > 0}
					conversationId={selectedId}
					contextSnippets={contextSnippets}
					onSend={handleSend}
					onUpload={handleUpload}
					onRemoveContext={handleRemoveContext}
					onClearContext={handleClearContext}
				/>

				<DocumentViewer
					documents={documents}
					onAddContext={handleAddContext}
					onDeleteDocument={removeDocument}
				/>
			</div>
		</TooltipProvider>
	);
}
