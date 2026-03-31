import { ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getDocumentUrl } from "../lib/api";
import type { Document } from "../types";
import { Button } from "./ui/button";

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
	const [currentPage, setCurrentPage] = useState(1);
	const [pdfLoading, setPdfLoading] = useState(true);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const [dragging, setDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Reset page when switching documents
	useEffect(() => {
		setCurrentPage(1);
		setNumPages(0);
		setPdfLoading(true);
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
					<div className="flex gap-1 overflow-x-auto pb-0">
						{documents.map((doc, i) => (
							<button
								key={doc.id}
								type="button"
								onClick={() => setSelectedIndex(i)}
								className={`flex-shrink-0 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors ${
									i === selectedIndex
										? "border-neutral-200 bg-white text-neutral-800"
										: "border-transparent bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
								}`}
								title={doc.filename}
							>
								<span className="max-w-[120px] truncate block">
									{doc.filename}
								</span>
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

			{/* PDF content */}
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
						setPdfLoading(false);
						setPdfError(null);
					}}
					onLoadError={(error) => {
						setPdfError(`Failed to load PDF: ${error.message}`);
						setPdfLoading(false);
					}}
					loading={
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
						</div>
					}
				>
					{!pdfLoading && !pdfError && (
						<Page
							pageNumber={currentPage}
							width={pdfPageWidth}
							loading={
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
								</div>
							}
						/>
					)}
				</PDFDocument>
			</div>

			{/* Page navigation */}
			{numPages > 0 && (
				<div className="flex items-center justify-center gap-3 border-t border-neutral-100 px-4 py-2.5">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						disabled={currentPage <= 1}
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<span className="text-xs text-neutral-500">
						Page {currentPage} of {numPages}
					</span>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						disabled={currentPage >= numPages}
						onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			)}
		</div>
	);
}
