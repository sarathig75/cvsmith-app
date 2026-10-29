"""Names in a suggestion that the CV does not contain (skills, employers, people).

Contract: docs/API_CONTRACT.md, "Suggestion guard: missing details". A suggestion is never rejected
for this; the user is asked to add the detail to the CV first. The evaluation runner uses the same rule.
"""
import json
import re
from typing import List, Optional

WORD = re.compile(r"[A-Za-z][A-Za-z0-9+#./&-]*")
SENTENCE_BREAK = re.compile(r"[.!?;:\n•]+")
EXPANSION = re.compile(r"((?:[A-Za-z][A-Za-z-]*\s+){1,8}[A-Za-z][A-Za-z-]*)\s*\(([A-Za-z]{2,8})\)")
ACRONYM_FIRST = re.compile(r"\b([A-Za-z]{2,8})\s*\(((?:[A-Za-z][A-Za-z-]*\s+){1,8}[A-Za-z][A-Za-z-]*)\)")


def unlisted_capitalised(suggested: str, original: str, cv: Optional[dict]) -> List[str]:
    """Capitalised words in the suggestion that the candidate never wrote: a skill, employer or name we
    would be inventing. The first word of each sentence or bullet is skipped (it is capitalised anyway)."""
    corpus = " ".join([original or "", json.dumps(cv or {}, ensure_ascii=False)])
    known = set(WORD.findall(corpus.lower()))
    # House style rule 9: an acronym the CV uses may be spelled out, e.g. "Production Part Approval
    # Process (PPAP)". The words of such an expansion are not new.
    expansions = set()
    for match in EXPANSION.finditer(suggested):  # "Words (ACR)"
        if match.group(2) in known or match.group(2).lower() in known:
            expansions.update(WORD.findall(match.group(1)))
    for match in ACRONYM_FIRST.finditer(suggested):  # "ACR (Words)"
        if match.group(1) in known or match.group(1).lower() in known:
            expansions.update(WORD.findall(match.group(2)))
    unlisted = []
    for segment in SENTENCE_BREAK.split(suggested):
        words = WORD.findall(segment)
        for word in words[1:]:
            if word[0].isupper() and len(word) > 1 and word.lower() not in known and word not in unlisted \
                    and word not in expansions:
                unlisted.append(word)
    return unlisted
