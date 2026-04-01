import {
	ChevronDown,
	ChevronUp,
	FileText,
	Loader2,
	Search,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getDocumentUrl } from "../lib/api";
import type { ContextSnippet, Document } from "../types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

const MIN_WIDTH = 280;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 400;

const HIGHLIGHT_COLOR = "rgba(253, 224, 71, 0.55)"; // yellow
const HIGHLIGHT_CURRENT_COLOR = "rgba(251, 146, 60, 0.7)"; // orange

interface DocumentViewerProps {
	documents: Document[];
	onAddContext?: (snippet: Omit<ContextSnippet, "id">) => void;
	onDeleteDocument?: (id: string) => void;
}

export function DocumentViewer({
	documents,
	onAddContext,
	onDeleteDocument,
}: DocumentViewerProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [numPages, setNumPages] = useState<number>(0);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const [dragging, setDragging] = useState(false);
	const [selectionPos, setSelectionPos] = useState<{
		x: number;
		y: number;
		text: string;
		page: number;
	} | null>(null);

	// Search state
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [matchCount, setMatchCount] = useState(0);
	const [currentMatch, setCurrentMatch] = useState(0);
	const matchesRef = useRef<HTMLElement[]>([]);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const addBtnRef = useRef<HTMLButtonElement>(null);

	// ── Search logic ─────────────────────────────────────────────────────────

	const clearHighlights = useCallback(() => {
		for (const el of matchesRef.current) {
			el.style.backgroundColor = "";
			el.style.borderRadius = "";
		}
		matchesRef.current = [];
	}, []);

	const closeSearch = useCallback(() => {
		setSearchOpen(false);
		setSearchQuery("");
		setMatchCount(0);
		setCurrentMatch(0);
		clearHighlights();
	}, [clearHighlights]);

	const runSearch = useCallback(
		(query: string, jumpToIndex = 0) => {
			clearHighlights();

			if (!query.trim() || !scrollRef.current) {
				setMatchCount(0);
				setCurrentMatch(0);
				return;
			}

			const q = query.toLowerCase();
			const spans = Array.from(
				scrollRef.current.querySelectorAll<HTMLElement>(
					".react-pdf__Page__textContent span",
				),
			).filter((span) => (span.textContent ?? "").toLowerCase().includes(q));

			matchesRef.current = spans;
			setMatchCount(spans.length);

			if (spans.length === 0) {
				setCurrentMatch(0);
				return;
			}

			const idx = Math.min(jumpToIndex, spans.length - 1);
			setCurrentMatch(idx + 1);

			for (const [i, span] of spans.entries()) {
				span.style.backgroundColor =
					i === idx ? HIGHLIGHT_CURRENT_COLOR : HIGHLIGHT_COLOR;
				span.style.borderRadius = "2px";
			}

			spans[idx].scrollIntoView({ behavior: "smooth", block: "center" });
		},
		[clearHighlights],
	);

	const navigate = useCallback(
		(delta: number) => {
			const spans = matchesRef.current;
			if (!spans.length) return;
			const prevIdx = currentMatch - 1;
			const newIdx = (prevIdx + delta + spans.length) % spans.length;
			spans[prevIdx].style.backgroundColor = HIGHLIGHT_COLOR;
			spans[newIdx].style.backgroundColor = HIGHLIGHT_CURRENT_COLOR;
			spans[newIdx].scrollIntoView({ behavior: "smooth", block: "center" });
			setCurrentMatch(newIdx + 1);
		},
		[currentMatch],
	);

	// Re-run search when new pages finish rendering
	useEffect(() => {
		if (searchQuery && numPages > 0) {
			const timer = setTimeout(
				() => runSearch(searchQuery, currentMatch - 1),
				150,
			);
			return () => clearTimeout(timer);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [numPages]);

	// Ctrl+F / Cmd+F to open search
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "f" && documents.length > 0) {
				e.preventDefault();
				setSearchOpen(true);
				setTimeout(() => searchInputRef.current?.focus(), 0);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [documents.length]);

	// Clear search when switching documents
	useEffect(() => {
		closeSearch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedIndex]);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const q = e.target.value;
			setSearchQuery(q);
			runSearch(q);
		},
		[runSearch],
	);

	const handleSearchKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				navigate(e.shiftKey ? -1 : 1);
			} else if (e.key === "Escape") {
				closeSearch();
			}
		},
		[navigate, closeSearch],
	);

	// ── Selection / context logic ─────────────────────────────────────────────

	const handleMouseUp = useCallback(() => {
		if (!onAddContext) return;
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed) return;
		const text = selection.toString().trim();
		if (!text || !containerRef.current) return;

		const range = selection.getRangeAt(0);
		if (!containerRef.current.contains(range.commonAncestorContainer)) return;

		let node: Node | null = range.startContainer;
		let page = 1;
		while (node && node !== containerRef.current) {
			if (node instanceof Element) {
				const p = node.getAttribute("data-page");
				if (p) {
					page = Number.parseInt(p, 10);
					break;
				}
			}
			node = node.parentNode;
		}

		const rect = range.getBoundingClientRect();
		const containerRect = containerRef.current.getBoundingClientRect();
		setSelectionPos({
			text,
			page,
			x: Math.min(
				Math.max(rect.left + rect.width / 2 - containerRect.left, 64),
				containerRect.width - 64,
			),
			y: rect.top - containerRect.top,
		});
	}, [onAddContext]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (addBtnRef.current?.contains(e.target as Node)) return;
		setSelectionPos(null);
	}, []);

	// ── Resize logic ──────────────────────────────────────────────────────────

	const handleResizeMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setDragging(true);

			const startX = e.clientX;
			const startWidth = width;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = startX - moveEvent.clientX;
				setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
			};

			const handleMouseUp = () => {
				setDragging(false);
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
		},
		[width],
	);

	// Keep selectedIndex in bounds when documents change
	useEffect(() => {
		if (documents.length > 0 && selectedIndex >= documents.length) {
			setSelectedIndex(documents.length - 1);
		}
	}, [documents, selectedIndex]);

	const pdfPageWidth = width - 48;

	// ── Render ────────────────────────────────────────────────────────────────

	if (documents.length === 0) {
		return (
			<div
				style={{ width }}
				className="flex h-full flex-shrink-0 flex-col items-center justify-center border-l border-neutral-200 bg-neutral-50"
			>
				<FileText className="mb-3 h-10 w-10 text-neutral-300" />
				<p className="text-sm text-neutral-400">No document uploaded</p>
			</div>
		);
	}

	const document = documents[selectedIndex] ?? documents[0];
	const pdfUrl = getDocumentUrl(document.id);

	return (
		<div
			ref={containerRef}
			style={{ width }}
			className="relative flex h-full flex-shrink-0 flex-col border-l border-neutral-200 bg-white"
			onMouseUp={handleMouseUp}
			onMouseDown={handleMouseDown}
		>
			{/* Resize handle */}
			<div
				className={`absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-neutral-300 ${
					dragging ? "bg-neutral-400" : ""
				}`}
				onMouseDown={handleResizeMouseDown}
			/>

			{/* Floating "Add to context" button */}
			{selectionPos && onAddContext && (
				<button
					ref={addBtnRef}
					type="button"
					style={{
						left: selectionPos.x,
						top: Math.max(selectionPos.y - 36, 8),
						transform: "translateX(-50%)",
					}}
					className="absolute z-30 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg hover:bg-neutral-700"
					onMouseDown={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onAddContext({
							text: selectionPos.text,
							documentName: document.filename,
							page: selectionPos.page,
						});
						setSelectionPos(null);
						window.getSelection()?.removeAllRanges();
					}}
				>
					Add to context
				</button>
			)}

			{/* Header */}
			<div className="border-b border-neutral-100 px-4 pt-3 pb-0">
				{documents.length > 1 ? (
					<div className="flex gap-1">
						{documents.map((doc, i) => (
							<div
								key={doc.id}
								className={`group relative min-w-0 flex-1 rounded-t-md border border-b-0 transition-colors ${
									i === selectedIndex
										? "border-neutral-200 bg-white"
										: "border-transparent bg-neutral-100 hover:bg-neutral-200"
								}`}
							>
								<button
									type="button"
									onClick={() => setSelectedIndex(i)}
									className={`w-full px-3 py-1.5 pr-6 text-xs font-medium ${
										i === selectedIndex
											? "text-neutral-800"
											: "text-neutral-500 hover:text-neutral-700"
									}`}
									title={doc.filename}
								>
									<span className="truncate block">{doc.filename}</span>
								</button>
								{onDeleteDocument && (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteDocument(doc.id);
										}}
										className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-red-500 group-hover:opacity-100"
										title="Remove document"
									>
										<X className="h-3 w-3" />
									</button>
								)}
							</div>
						))}
					</div>
				) : (
					<div className="flex items-center justify-between pb-2">
						<p className="truncate text-sm font-medium text-neutral-800">
							{document.filename}
						</p>
						{onDeleteDocument && (
							<button
								type="button"
								onClick={() => onDeleteDocument(document.id)}
								className="ml-2 flex-shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-500"
								title="Remove document"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				)}
			</div>

			{/* Sub-header: page count + search toggle */}
			<div className="flex items-center justify-between border-b border-neutral-100 px-4 py-1.5">
				<p className="text-xs text-neutral-400">
					{document.page_count} page{document.page_count !== 1 ? "s" : ""}
				</p>
				<button
					type="button"
					onClick={() => {
						if (searchOpen) {
							closeSearch();
						} else {
							setSearchOpen(true);
							setTimeout(() => searchInputRef.current?.focus(), 0);
						}
					}}
					className={`rounded p-1 transition-colors ${
						searchOpen
							? "bg-neutral-200 text-neutral-700"
							: "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
					}`}
					title="Search (Ctrl+F)"
				>
					<Search className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Search bar */}
			{searchOpen && (
				<div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
					<input
						ref={searchInputRef}
						value={searchQuery}
						onChange={handleSearchChange}
						onKeyDown={handleSearchKeyDown}
						placeholder="Search in document…"
						className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 placeholder-neutral-400 outline-none"
					/>
					{searchQuery.length > 0 && (
						<span className="flex-shrink-0 tabular-nums text-xs text-neutral-400">
							{matchCount === 0
								? "No results"
								: `${currentMatch} / ${matchCount}`}
						</span>
					)}
					<button
						type="button"
						onClick={() => navigate(-1)}
						disabled={matchCount === 0}
						className="flex-shrink-0 rounded p-0.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
						title="Previous (Shift+Enter)"
					>
						<ChevronUp className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => navigate(1)}
						disabled={matchCount === 0}
						className="flex-shrink-0 rounded p-0.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
						title="Next (Enter)"
					>
						<ChevronDown className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={closeSearch}
						className="flex-shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
						title="Close (Esc)"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{/* PDF content — continuous scroll */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
				{pdfError && (
					<div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
						{pdfError}
					</div>
				)}

				<PDFDocument
					key={document.id}
					file={pdfUrl}
					onLoadSuccess={({ numPages: pages }) => {
						setNumPages(pages);
						setPdfError(null);
					}}
					onLoadError={(error) => {
						setPdfError(`Failed to load PDF: ${error.message}`);
					}}
					loading={
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
						</div>
					}
				>
					{Array.from({ length: numPages }, (_, i) => (
						<div key={i + 1} data-page={i + 1} className="mb-4 last:mb-0">
							<Page
								pageNumber={i + 1}
								width={pdfPageWidth}
								loading={
									<div
										style={{
											width: pdfPageWidth,
											height: pdfPageWidth * 1.414,
										}}
										className="flex items-center justify-center bg-neutral-50"
									>
										<Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
									</div>
								}
							/>
							<p className="mt-1.5 text-center text-[11px] text-neutral-400 select-none">
								{i + 1} / {numPages}
							</p>
						</div>
					))}
				</PDFDocument>
			</div>
		</div>
	);
}
