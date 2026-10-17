---
section: projects
depth: full
catalogue: DCL-104
order: 4
title: Thesis
format: 7in
tagline: GraphRAG vs. hybrid retrieval on Indonesian tax regulations.
role: Undergraduate thesis
team: Solo thesis
org: Informatics Engineering, Universitas Padjadjaran
dates: Feb 2026–present
stage:
  kind: chart
  alt: 'Bar chart: recall@5 on the test split (n = 33), hybrid baseline 0.571, with graph expansion 0.677.'
  chart:
    title: Retrieval on the test split (n = 33)
    metric: recall@5
    series:
      - label: Hybrid baseline
        value: 0.571
      - label: + Graph expansion
        value: 0.677
    note: 'Δ +0.106 · 95% CI [+0.020, +0.202] · p = 0.044'
summary:
  problem: Legal questions often need several connected articles, which plain keyword-plus-vector retrieval can miss.
  role: Undergraduate thesis
  result: 'On the test split (n = 33), graph expansion improved recall@5 from 0.571 to 0.677 (Δ +0.106, 95% CI [+0.020, +0.202], p = 0.044) and precision@5 from 0.170 to 0.212 (p = 0.035) over the hybrid baseline. On pure dense seeds it showed no significant effect (Δ +0.020, p = 0.55). Generation-quality (RAGAS) gains were directional only.'
stack:
  - Python
  - ChromaDB
  - Neo4j
  - BM25 + dense retrieval (RRF)
  - 'Ollama (qwen3.5:9b)'
  - RAGAS (claude-haiku-4-5 as judge)
credits:
  darren:
    - 'Built the corpus from JDIH: 118,966 deduplicated articles, indexed in ChromaDB (dense) and Neo4j (graph), with 81,315 reference edges between articles.'
    - Designed the comparison so both systems share an identical seeding stage, making graph expansion the only difference between them.
    - Wrote and verified a 50-question evaluation set (29 multi-hop, 21 single-hop as a control), with a frozen dev/test split (17/33).
    - Evaluated with recall@5, precision@5, hit@5, MRR, and RAGAS (LLM-as-judge), using Wilcoxon signed-rank tests and 95% bootstrap confidence intervals.
    - Ran a reachability audit to separate gaps in the graph from failures of the system.
  team:
    - 'Supervisors: Drs. Akik Hidayat, M.Kom. and Dr. Mira Suryani, S.Pd., M.Kom.'
decisions:
  - topic: Comparable by construction
    chose: An identical seeding pipeline for both systems
    rejected: Comparing two independent systems
    why: Any performance difference can then be attributed solely to graph expansion.
  - topic: Separate judge
    chose: 'A different model as the RAGAS judge (claude-haiku-4-5) than the generator (qwen3.5:9b via Ollama)'
    rejected: "Letting the generator's own model judge its answers"
    why: Avoids the judge being biased toward its own output.
  - topic: Report what the data supports
    chose: Keep null and negative results (no graph benefit under dense-only seeding) as they are, with the small-sample caveats
    why: Claims must match what the confidence intervals support.
learned: The latest technique, such as GraphRAG, doesn't always give the best result, and not for every use case.
cover:
  ground: '#D9A898'
  ink: '#1B1714'
  accents: []
  motif: graph
  caption: BONUS SINGLE
---

An undergraduate thesis in Informatics Engineering at Universitas Padjadjaran, comparing GraphRAG with hybrid retrieval on Indonesian tax regulations.

Legal questions often need several connected articles, which plain keyword-plus-vector retrieval can miss. The thesis tests whether following the references between articles (a graph) retrieves better context than a hybrid baseline.

**Finding** (test split, n = 33):

- Graph expansion improved recall@5 from 0.571 to 0.677 (Δ +0.106, 95% CI \[+0.020, +0.202\], p = 0.044) and precision@5 from 0.170 to 0.212 (p = 0.035) over the hybrid baseline.
- On pure dense seeds, graph expansion showed no significant effect (Δ +0.020, p = 0.55).
- Generation-quality (RAGAS) gains were directional only.
