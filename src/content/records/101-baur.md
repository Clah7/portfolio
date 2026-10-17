---
section: projects
depth: full
catalogue: DCL-101
order: 1
title: Baur
format: 12in
tagline: Indonesian regional culture learning app for iOS.
role: Developer
team: Team of 10
org: Apple Developer Academy
dates: Jul–Sep 2026
platform: iOS
stage:
  kind: gallery
  device: phone
  alt: Baur app screens
  images:
    - src: records/baur/screen-1.webp
      alt: "An airmail envelope labelled YOGYAKARTA, with a Jogjakarta stamp, on an old-paper background, and the hint 'Tap the envelope to open'."
      caption: Opening the Yogyakarta envelope
    - src: records/baur/screen-2.webp
      alt: "A video scene of a man at a food stall with the question 'Do you know what nasi and sate kucing are?' and two answers: A, 'Huh? Cat rice?', and B, 'Of course I know!'"
      caption: A question in the story
    - src: records/baur/screen-3.webp
      alt: "Over a dimmed video, the prompt 'Knock on Mr. RT's gate (3x)' with the instruction 'Shake your phone to knock on the gate' and a Skip button."
      caption: 'Shake to knock: a gesture prompt'
summary:
  problem: Young adults navigating unfamiliar cultural norms.
  role: Developer
  result: Tested with users.
stack: [SwiftUI, SwiftData, AVFoundation, CoreMotion]
credits:
  darren:
    - Built the gesture interactions with CoreMotion.
    - Handled data storage and connected the CoreMotion gesture logic to the interface.
    - Conducted user interviews.
    - Helped film the story videos, setting up the lighting.
  team:
    - Ran qualitative interviews on how young adults navigate unfamiliar Indonesian cultural traditions, built affinity maps and iterated on challenge and user-need statements.
    - 'Research frameworks: a five-stage pain chain, a broker-variable model and a two-axis norm typology.'
    - Made an app that features video-based storytelling with gesture interactions and cultural flashcards.
decisions:
  - topic: How stories are told
    chose: Video-based storytelling
    rejected: Articles
    why: Video shows the context and environment of each situation, so it's easier to understand; text-only articles overwhelmed users.
  - topic: How you take part
    chose: Gesture interactions (CoreMotion)
    rejected: Simple taps or buttons
    why: Gestures immerse the user in the situation.
  - topic: A learning tool, not a test
    chose: No scores or tests
    rejected: Scoring and quizzes
    why: Baur is a learning tool, not an assessment tool.
bsides:
  - idea: Online forums
    whyCut: They depend on users for content, with too many edge cases, such as wrong information being shared.
learned: To empathise more with users.
cover:
  ground: '#1E4D4F'
  ink: '#F3E6C8'
  accents: ['#D9A23A', '#C2603A']
  motif: rings
  caption: INDONESIAN REGIONAL CULTURE · iOS
---

Baur is an iOS app for learning about Indonesia's regional cultures, made by a team of 10 at Apple Developer Academy.

The team interviewed young adults on navigating unfamiliar cultural norms and turned the findings into user needs. The app features video-based storytelling with gesture interactions and cultural flashcards.

**Content pillars:** food, language and terms, and unwritten norms.

**Positioning:** a learning tool, not an assessment tool. Collectible fragments are the rewards.

**The research (team):** qualitative interviews on how young adults navigate unfamiliar Indonesian cultural traditions, affinity maps, and iterated challenge and user-need statements. The frameworks that came out of it: a five-stage pain chain, a broker-variable model and a two-axis norm typology.

**What the research showed:** Using a user journey map, the team found the gap: people often don't know what they did wrong, because they simply act the way they usually do.
