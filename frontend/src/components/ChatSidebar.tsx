import { AnimatePresence, motion } from "framer-motion";
import { MessageSquarePlus, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";
import type { Conversation } from "../types";
import { Button } from "./ui/button";

interface ChatSidebarProps {
	conversations: Conversation[];
	selectedId: string | null;
	loading: boolean;
	onSelect: (id: string) => void;
	onCreate: () => void;
	onDelete: (id: string) => void;
}

export function ChatSidebar({
	conversations,
	selectedId,
	loading,
	onSelect,
	onCreate,
	onDelete,
}: ChatSidebarProps) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [searchResults, setSearchResults] = useState<Conversation[] | null>(
		null,
	);
	const [searching, setSearching] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!query.trim()) {
			setSearchResults(null);
			return () => {};
		}
		debounceRef.current = setTimeout(async () => {
			setSearching(true);
			try {
				const results = await api.searchConversations(query.trim());
				setSearchResults(results);
			} finally {
				setSearching(false);
			}
		}, 300);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	const displayed = searchResults ?? conversations;

	return (
		<div className="flex h-full w-[250px] flex-shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white">
			<div className="flex items-center justify-between border-b border-neutral-100 p-3">
				<span className="text-sm font-semibold text-neutral-700">Chats</span>
				<Button variant="ghost" size="icon" onClick={onCreate} title="New chat">
					<MessageSquarePlus className="h-4 w-4" />
				</Button>
			</div>

			<div className="border-b border-neutral-100 px-3 py-2">
				<div className="flex items-center gap-2 rounded-md bg-neutral-100 px-2 py-1.5">
					<Search className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search conversations..."
						className="min-w-0 flex-1 bg-transparent text-xs text-neutral-700 placeholder-neutral-400 outline-none"
					/>
					{query && (
						<button type="button" onClick={() => setQuery("")}>
							<X className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600" />
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto overflow-x-hidden">
				<div className="w-full p-2">
					{loading && conversations.length === 0 && (
						<div className="space-y-2 p-2">
							{[1, 2, 3].map((i) => (
								<div key={i} className="animate-pulse space-y-1">
									<div className="h-4 w-3/4 rounded bg-neutral-100" />
									<div className="h-3 w-1/2 rounded bg-neutral-50" />
								</div>
							))}
						</div>
					)}

					{!loading && !searching && displayed.length === 0 && (
						<p className="px-2 py-8 text-center text-xs text-neutral-400">
							{query ? "No results found" : "No conversations yet"}
						</p>
					)}

					{searching && (
						<p className="px-2 py-4 text-center text-xs text-neutral-400">
							Searching...
						</p>
					)}

					<AnimatePresence initial={false}>
						{displayed.map((conversation) => (
							<motion.div
								key={conversation.id}
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								exit={{ opacity: 0, height: 0 }}
								transition={{ duration: 0.15 }}
							>
								<div
									role="button"
									tabIndex={0}
									className={`relative flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-left transition-colors ${
										selectedId === conversation.id
											? "bg-neutral-100"
											: "hover:bg-neutral-50"
									}`}
									onClick={() => onSelect(conversation.id)}
									onKeyDown={(e) =>
										e.key === "Enter" && onSelect(conversation.id)
									}
									onMouseEnter={() => setHoveredId(conversation.id)}
									onMouseLeave={() => setHoveredId(null)}
								>
									{hoveredId === conversation.id && (
										<button
											type="button"
											className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-500"
											onClick={(e) => {
												e.stopPropagation();
												onDelete(conversation.id);
											}}
											title="Delete conversation"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									)}

									<div
										className={`min-w-0 flex-1 overflow-hidden transition-opacity ${hoveredId === conversation.id ? "opacity-20" : "opacity-100"}`}
									>
										<p className="truncate text-sm font-medium text-neutral-800">
											{conversation.title}
										</p>
										<p className="mt-0.5 text-xs text-neutral-400">
											{relativeTime(conversation.updated_at)}
										</p>
									</div>
								</div>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
