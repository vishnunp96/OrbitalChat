import { Paperclip, SendHorizontal, X } from "lucide-react";
import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import type { ContextSnippet } from "../types";
import { Button } from "./ui/button";

interface ChatInputProps {
	onSend: (content: string) => void;
	onUpload: (file: File) => void;
	disabled: boolean;
	contextSnippets?: ContextSnippet[];
	onRemoveContext?: (id: string) => void;
	onClearContext?: () => void;
}

export function ChatInput({
	onSend,
	onUpload,
	disabled,
	contextSnippets = [],
	onRemoveContext,
	onClearContext,
}: ChatInputProps) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleSend = useCallback(() => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;

		let content = trimmed;
		if (contextSnippets.length > 0) {
			const passages = contextSnippets
				.map((s) => `From "${s.documentName}" (page ${s.page}):\n> ${s.text}`)
				.join("\n\n");
			content = `Referring to the following passages:\n\n${passages}\n\n${trimmed}`;
		}

		onSend(content);
		setValue("");
		onClearContext?.();
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}, [value, disabled, onSend, contextSnippets, onClearContext]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleInput = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	}, []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				onUpload(file);
			}
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		},
		[onUpload],
	);

	return (
		<div className="border-t border-neutral-200 bg-white p-3">
			{contextSnippets.length > 0 && (
				<div className="mb-2 space-y-1.5">
					{contextSnippets.map((snippet) => (
						<div
							key={snippet.id}
							className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
						>
							<div className="min-w-0 flex-1 border-l-2 border-neutral-300 pl-2">
								<p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
									{snippet.documentName} · p.{snippet.page}
								</p>
								<p className="line-clamp-2 text-xs italic text-neutral-600">
									{snippet.text}
								</p>
							</div>
							<button
								type="button"
								onClick={() => onRemoveContext?.(snippet.id)}
								className="mt-0.5 flex-shrink-0 text-neutral-400 hover:text-neutral-600"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					))}
				</div>
			)}

			<div className="flex items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 flex-shrink-0"
					onClick={() => fileInputRef.current?.click()}
				>
					<Paperclip className="h-4 w-4 text-neutral-500" />
				</Button>

				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf"
					className="hidden"
					onChange={handleFileChange}
				/>

				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onInput={handleInput}
					onKeyDown={handleKeyDown}
					placeholder="Ask a question about your documents..."
					rows={1}
					className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none"
					disabled={disabled}
				/>

				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 flex-shrink-0"
					disabled={!value.trim() || disabled}
					onClick={handleSend}
				>
					<SendHorizontal
						className={`h-4 w-4 ${
							value.trim() && !disabled
								? "text-neutral-900"
								: "text-neutral-300"
						}`}
					/>
				</Button>
			</div>
		</div>
	);
}
