# Decisions

## Prioritised from feedback

| Feature | Status | Rationale |
|---|---|---|
| Improve citations | Done | Well-cited answers let users verify easily and drive higher satisfaction |
| Search through the PDF | Done | Commonly requested; low implementation cost |
| Export entire chat | Done | Commonly requested; low implementation cost |
| Reduce hallucinations | Not done | Requires chunked retrieval and tighter context grounding — more complexity than current scope allows |
| Reuse documents across conversations | Not done | Introduces significant complexity relative to the value delivered |
| Side-by-side document comparison | Not done | Specialised feature better suited to a dedicated document viewer |
| Confidence indicator | Not done | LLMs don't produce calibrated confidence scores; needs more design work |
| PDF annotations | Not done | Specialised feature better suited to a dedicated document viewer |

## Additional features shipped

- Multiple documents per conversation, with a tabbed viewer and close button per document
- PDF viewer with continuous scroll, page numbering, and in-viewer search (Ctrl+F)
- Select text in the PDF to add it as context for the conversation
- Conversation labels auto-generated from the first message, capped at 5 words and biased toward document names
- Conversation list is searchable by message content
- Conversations can be deleted from the sidebar
- Citations made more robust with deduplication
- Copy-to-clipboard on AI responses
- Export conversation to `.docx`
