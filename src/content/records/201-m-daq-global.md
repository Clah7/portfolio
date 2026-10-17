---
section: experience
depth: full
catalogue: DCL-201
order: 1
title: M-DAQ Global
format: 12in
tagline: A KYB document pipeline in n8n for Indonesian company documents, reducing document review time by 40%.
role: Product Management Intern
org: M-DAQ Global
dates: Aug 2025–Aug 2026
location: Remote
stage:
  kind: diagram
  alt: 'Document pipeline: company documents in, key information extracted (regex and n8n nodes), classified, one LLM call, a summary of changes over the years, out to a compliance reviewer.'
  steps:
    - Company documents in
    - Key information extracted (regex + n8n nodes)
    - Classified
    - One LLM call
    - Summary of changes over the years
    - Compliance reviewer
  caption: From stacks of company documents to a summary of what changed, year by year.
summary:
  problem: The compliance team reviewed Indonesian company documents by hand to work out what had changed in a company over the years.
  role: Product Management Intern
  result: Reduced document review time by 40%.
stack: [n8n, regex, LLM, MongoDB, web scraping]
credits:
  darren:
    - 'Built a KYB document pipeline in n8n for Indonesian company documents: extracts key information with regex, classifies it, and structures it into summaries of what changed over the years. Reduced document review time by 40%.'
    - 'Built an automated web research pipeline in n8n for KYB checks: searches and scrapes the web for a business name, processes the top 10 results with an LLM in parallel batches of five, and stores structured JSON in MongoDB.'
    - 'Mapped business onboarding requirements across four markets (Indonesia, Singapore, Hong Kong, Malaysia): about 56 fields across 8 onboarding steps, with market differences and open questions flagged.'
    - Designed reference UI components and user flows for financial ledger reconciliation.
    - Restructured a field-mapping spec into a config-ready format and designed a minimal reference UI component for it.
    - Wrote an implementation spec for standardizing company names across scripts via transliteration, for compliance screening.
  team:
    - Worked with a compliance-focused team and a bank reconciliation project team.
decisions:
  - topic: Fewer LLM calls
    chose: Regex and n8n's built-in nodes for extraction, cutting LLM usage from 3 calls to 1 per document
    rejected: Three LLM calls per document
    why: To cut cost while keeping results consistent, because regex is deterministic.
  - topic: Evidence before obligation
    chose: Mark a field's required/optional status as unknown ("?") until validation errors or admin configuration confirmed it
    rejected: Inferring status from screenshots
    why: A matrix that looks complete but is wrong is worse than one that is honest about gaps.
  - topic: One market at a time
    chose: Document each market separately before aggregating
    rejected: Building the comparison in one pass
    why: Each market's onboarding flow differed enough that comparing them all at once risked mistakes.
learned: Keeping a client's trust sometimes means spending more than the minimum, such as paying for ISO audits and putting extra resources into additional checks.
session:
  - steps:
      - Business name in
      - Web search + scrape (top 10 results)
      - LLM, 5 at a time in parallel
      - Structured JSON
      - MongoDB
    caption: Name in, structured findings out.
cover:
  ground: '#E6DFD0'
  ink: '#1C2A3E'
  accents: ['#7FA6C9']
  motif: documents
  caption: KYC / KYB · FINTECH
---

A remote product management internship at M-DAQ Global, a fintech company, from Aug 2025 to Aug 2026, working with a compliance-focused team and a bank reconciliation project team.

The main work was two n8n pipelines for KYB checks. The first turns Indonesian company documents into summaries of what changed over the years, which reduced document review time by 40%. The second researches a business name on the web and stores structured findings in MongoDB.

Alongside them: onboarding requirements mapped across four markets, reference UI components and user flows for financial ledger reconciliation, a config-ready field-mapping spec, and an implementation spec for standardizing company names via transliteration.
