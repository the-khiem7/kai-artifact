# Verify brief (subagent prompt template)

Fill the placeholders and send one agent per note, all in a single message so they run in parallel.

```
Fact-check the note at <absolute path>. Read it in full first.

Task:
1. List every checkable factual claim (versions, dates, prices, limits, product behaviour, who owns what). Skip opinions and analysis.
2. For each claim find an official source (vendor docs, release notes, press release, standards body). Blogs and forums are not enough to mark a claim verified.
3. Classify each claim: verified, refuted (give the correct fact), or unverified (no official source found).
4. For each verified or refuted claim give the URL plus a text fragment `#:~:text=<text>` copied verbatim from the fetched page, percent-encoded (`%20` for spaces, `%2D` `%26` `%2C` for - & ,). If you only saw the text in a search snippet or summary and not on the fetched page, say "fragment unverified".

Rules:
- Do not edit any file. Return a report only.
- Do not guess. Say "unverified" rather than infer.
- The note's claims came from an AI chat: expect some to be wrong or outdated. Today's date is <YYYY-MM-DD>; check whether dated claims still hold.

Report format: a table with columns claim | status | correct fact (if refuted) | source URL with fragment. Then a short list of claims with no source found.
```

After the reports arrive, fold them into the note as described in SKILL.md step 5. Do not paste an agent's conclusion without reading the cited passage when the claim matters for a purchase, legal or security decision.
