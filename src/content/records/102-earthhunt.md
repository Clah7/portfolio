---
section: projects
depth: full
catalogue: DCL-102
order: 2
title: EarthHunt
format: 12in
tagline: Children's English vocabulary camera app for iOS, with on-device image and speech recognition.
role: Product Manager
team: Team of 5
org: Apple Developer Academy
dates: May–Jun 2026
platform: iOS
stage:
  kind: gallery
  device: tablet
  orientation: landscape
  alt: EarthHunt app screens
  images:
    - src: records/earthhunt/screen-1.webp
      alt: "Welcome screen in pixel art: a pixel Earth with a UFO above the heading 'Greetings, Drone!', a short mission text about finding objects, scanning them and beaming the discoveries up to the Hive, a card reading 'Recommended age: ages 5–6 years', a 'Tap to listen' button and a pink LAUNCH! button."
      caption: The welcome screen
    - src: records/earthhunt/screen-2.webp
      alt: "EarthHunt home screen in pixel art: the EARTH HUNT title above a pink LET'S HUNT button and a teal COLLECTION button, with a pixel Earth, an orange creature and a UFO below."
      caption: The home screen
summary:
  problem: Children learning English vocabulary.
  role: Product Manager
stack:
  - SwiftUI
  - Apple Vision framework
  - Foundation Models framework
  - MobileCLIP-S2
  - Apple Speech framework
  - Aseprite (pixel-art assets)
credits:
  darren:
    - Ran daily meetings.
    - Split work into tasks sized with story points.
    - Wrote the PRD and each feature's definition of done.
    - Kept the project on its timeline.
    - Helped the team by making the UI assets as pixel art in Aseprite.
    - Helped with UI slicing, turning the designs into the SwiftUI interface.
    - Planned the demo video.
  team:
    - On-device image recognition (MobileCLIP-S2).
    - On-device speech recognition.
decisions:
  - topic: How kids learn
    chose: 'The camera: kids take a picture of a real object to learn its English word'
    rejected: A drag-and-drop game matching objects to written words
    why: Some young kids can't read text yet, so a text-based game wasn't accessible enough.
bsides:
  - idea: A drag-and-drop matching game
    whyCut: With young users, accessibility had to come first, and some kids can't read yet.
learned: Making a learning app is hard. The difficulty has to be just right, so kids stay engaged without feeling pressured.
cover:
  ground: '#3F6B3A'
  ink: '#F2E8C9'
  accents: []
  motif: lens
  caption: VOCABULARY · CAMERA · iOS
---

EarthHunt is a children's English vocabulary camera app for iOS, built in SwiftUI. It uses on-device image recognition with MobileCLIP-S2 and on-device speech recognition.

Darren was the Product Manager, and also helped the team by making the UI assets as pixel art in Aseprite, helped with UI slicing (turning the designs into the SwiftUI interface) and planned the demo video.
