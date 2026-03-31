import { motion } from "framer-motion";
import { Bot, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type { Message } from "../types";

interface MessageBubbleProps {
	message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
	if (message.role === "system") {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="flex justify-center py-2"
			>
				<p className="text-xs text-neutral-400">{message.content}</p>
			</motion.div>
		);
	}

	if (message.role === "user") {
		return (
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
				className="flex justify-end py-1.5"
			>
				<div className="max-w-[75%] rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5">
					<p className="whitespace-pre-wrap text-sm text-neutral-800">
						{message.content}
					</p>
				</div>
			</motion.div>
		);
	}

	// Assistant message
	return <AssistantBubble message={message} />;
}

function AssistantBubble({ message }: { message: Message }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(message.content).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2 }}
			className="group flex gap-3 py-1.5"
		>
			<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900">
				<Bot className="h-4 w-4 text-white" />
			</div>
			<div className="min-w-0 max-w-[80%]">
				<div className="prose">
					<Streamdown>{message.content}</Streamdown>
				</div>
				<div className="mt-1.5 flex items-center gap-2">
					{message.sources_cited > 0 && (
						<p className="text-xs text-neutral-400">
							{message.sources_cited} source
							{message.sources_cited !== 1 ? "s" : ""} cited
						</p>
					)}
					<button
						type="button"
						onClick={handleCopy}
						className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100"
						title="Copy to clipboard"
					>
						{copied ? (
							<Check className="h-3 w-3 text-green-500" />
						) : (
							<Copy className="h-3 w-3" />
						)}
						{copied ? "Copied" : "Copy"}
					</button>
				</div>
			</div>
		</motion.div>
	);
}

interface StreamingBubbleProps {
	content: string;
}

export function StreamingBubble({ content }: StreamingBubbleProps) {
	return (
		<div className="flex gap-3 py-1.5">
			<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900">
				<Bot className="h-4 w-4 text-white" />
			</div>
			<div className="min-w-0 max-w-[80%]">
				{content ? (
					<div className="prose">
						<Streamdown mode="streaming">{content}</Streamdown>
					</div>
				) : (
					<div className="flex items-center gap-1 py-2">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
						<span
							className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
							style={{ animationDelay: "0.15s" }}
						/>
						<span
							className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
							style={{ animationDelay: "0.3s" }}
						/>
					</div>
				)}
				<span className="inline-block h-4 w-0.5 animate-pulse bg-neutral-400" />
			</div>
		</div>
	);
}
