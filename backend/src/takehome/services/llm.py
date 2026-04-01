from __future__ import annotations

import re
from collections.abc import AsyncIterator

from pydantic_ai import Agent

from takehome.config import settings  # noqa: F401 — triggers ANTHROPIC_API_KEY export

agent = Agent(
    "anthropic:claude-haiku-4-5-20251001",
    system_prompt=(
        "You are a precise legal document assistant for commercial real estate lawyers. "
        "You help lawyers review and understand documents during due diligence.\n\n"
        "CITATION RULES — these are mandatory, not optional:\n"
        "1. Every factual statement drawn from the document MUST be followed immediately by a "
        "citation in parentheses, e.g. (Section 4.2), (Clause 7.1), (Page 12), (Article III), "
        "(Schedule A), (Exhibit B). Use the identifier that appears in the document itself.\n"
        "2. If a document uses numbered sections (e.g. '3.4 Rent Obligations'), cite as "
        "(Section 3.4). If it uses named clauses, cite the clause name. If it uses page numbers "
        "only, cite the page.\n"
        "3. When quoting the document verbatim, use quotation marks AND a citation: "
        '"...quoted text..." (Section 2.1).\n'
        "4. If the same fact is supported by multiple locations, list all: (Sections 2.1, 5.3).\n"
        "5. If information is NOT found in the document, state explicitly: "
        '"The document does not address this." Do not infer, assume, or fabricate.\n'
        "6. Do not omit citations for brevity. A response without citations for factual claims "
        "is incomplete and unacceptable.\n\n"
        "STYLE:\n"
        "- Be concise and precise. Lawyers value accuracy over verbosity.\n"
        "- Use plain language summaries followed by the exact citation.\n"
        "- Structure multi-part answers with bullet points, each with its own citation."
    ),
)


async def generate_title(user_message: str) -> str:
    """Generate a ≤5-word conversation title from the first user message."""
    result = await agent.run(
        "Generate a conversation title of AT MOST 5 words that captures the topic of this message. "
        "Rules: no punctuation at the end, no quotes, title case, 5 words maximum. "
        "Bias the summary towards the attached document names and legal questions asked."
        "Return only the title, nothing else.\n\n"
        f"Message: {user_message}"
    )
    title = str(result.output).strip().strip('"').strip("'").rstrip(".")
    # Hard-enforce 5-word limit in case the model ignores the instruction
    words = title.split()
    if len(words) > 5:
        title = " ".join(words[:5])
    return title or "New Conversation"


async def chat_with_document(
    user_message: str,
    document_text: str | None,
    conversation_history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Stream a response to the user's message, yielding text chunks.

    Builds a prompt that includes document context and conversation history,
    then streams the response from the LLM.
    """
    # Build the full prompt with context
    prompt_parts: list[str] = []

    # Add document context if available
    if document_text:
        prompt_parts.append(
            "The following is the content of the document being discussed:\n\n"
            "<document>\n"
            f"{document_text}\n"
            "</document>\n"
        )
    else:
        prompt_parts.append(
            "No document has been uploaded yet. If the user asks about a document, "
            "let them know they need to upload one first.\n"
        )

    # Add conversation history
    if conversation_history:
        prompt_parts.append("Previous conversation:\n")
        for msg in conversation_history:
            role = msg["role"]
            content = msg["content"]
            if role == "user":
                prompt_parts.append(f"User: {content}\n")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}\n")
        prompt_parts.append("\n")

    # Add the current user message
    prompt_parts.append(f"User: {user_message}")

    full_prompt = "\n".join(prompt_parts)

    async with agent.run_stream(full_prompt) as result:
        async for text in result.stream_text(delta=True):
            yield text


def count_sources_cited(response: str) -> int:
    """Count distinct inline citations to document sections, clauses, pages, etc.

    Matches parenthetical citations such as:
      (Section 4.2), (Clause 7.1), (Page 12), (Article III),
      (Schedule A), (Exhibit B), (Appendix C), (Annex 1),
      (Sections 2.1, 5.3)  — counted as one citation group
    Also matches bare references outside parentheses, e.g. "Section 4.2 provides..."
    De-duplicates identical citation strings so repeated references to the same
    location are counted only once.
    """
    # Parenthetical citations: (Section/Clause/Page/Article/Schedule/Exhibit/… identifier)
    paren_pattern = re.compile(
        r"\(\s*(?:sections?|clauses?|pages?|articles?|paragraphs?|schedules?|"
        r"exhibits?|appendix|appendices|annexes?|parts?|sub-?sections?)\s+[^\)]+\)",
        re.IGNORECASE,
    )
    # Bare references: "Section 4.2", "Clause 7", "Article III", "Schedule A", etc.
    bare_pattern = re.compile(
        r"\b(?:sections?|clauses?|pages?|articles?|paragraphs?|schedules?|"
        r"exhibits?|appendix|appendices|annexes?|parts?|sub-?sections?)\s+"
        r"[\w\.\-]+",
        re.IGNORECASE,
    )
    # Section symbol: § 4.2
    symbol_pattern = re.compile(r"§+\s*[\w\.\-]+")

    seen: set[str] = set()
    for m in (
        *paren_pattern.finditer(response),
        *bare_pattern.finditer(response),
        *symbol_pattern.finditer(response),
    ):
        seen.add(m.group().strip().lower())

    return len(seen)
