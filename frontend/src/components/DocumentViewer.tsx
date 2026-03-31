import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getDocumentUrl } from "../lib/api";
import type { Document } from "../types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

const MIN_WIDTH = 280;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 400;

interface DocumentViewerProps {
	documents: Document[];
}

export function DocumentViewer({ documents }: DocumentViewerProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [numPages, setNumPages] = useState<number>(0);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const [dragging, setDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Reset when switching documents
	useEffect(() => {
		setNumPages(0);
		setPdfError(null);
	}, [selectedIndex]);

	// Keep selectedIndex in bounds when documents change
	useEffect(() => {
		if (documents.length > 0 && selectedIndex >= documents.length) {
			setSelectedIndex(documents.length - 1);
		}
	}, [documents, selectedIndex]);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setDragging(true);

			const startX = e.clientX;
			const startWidth = width;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = startX - moveEvent.clientX;
				const newWidth = Math.min(
					MAX_WIDTH,
					Math.max(MIN_WIDTH, startWidth + delta),
				);
				setWidth(newWidth);
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

	const pdfPageWidth = width - 48; // account for px-4 padding on each side

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
		>
			{/* Resize handle */}
			<div
				className={`absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-neutral-300 ${
					dragging ? "bg-neutral-400" : ""
				}`}
				onMouseDown={handleMouseDown}
			/>

			{/* Header */}
			<div className="border-b border-neutral-100 px-4 pt-3 pb-0">
				{documents.length > 1 ? (
					<div className="flex gap-1">
						{documents.map((doc, i) => (
							<button
								key={doc.id}
								type="button"
								onClick={() => setSelectedIndex(i)}
								className={`min-w-0 flex-1 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors ${
									i === selectedIndex
										? "border-neutral-200 bg-white text-neutral-800"
										: "border-transparent bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
								}`}
								title={doc.filename}
							>
								<span className="truncate block">{doc.filename}</span>
							</button>
						))}
					</div>
				) : (
					<div className="pb-2">
						<p className="truncate text-sm font-medium text-neutral-800">
							{document.filename}
						</p>
						<p className="text-xs text-neutral-400">
							{document.page_count} page{document.page_count !== 1 ? "s" : ""}
						</p>
					</div>
				)}
			</div>

			{documents.length > 1 && (
				<div className="border-b border-neutral-100 px-4 py-1.5">
					<p className="text-xs text-neutral-400">
						{document.page_count} page{document.page_count !== 1 ? "s" : ""}
					</p>
				</div>
			)}

			{/* PDF content — continuous scroll */}
			<div className="flex-1 overflow-y-auto p-4">
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
						<div key={i + 1} className="mb-4 last:mb-0">
							<Page
								pageNumber={i + 1}
								width={pdfPageWidth}
								loading={
									<div
										style={{ width: pdfPageWidth, height: pdfPageWidth * 1.414 }}
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
