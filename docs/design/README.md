# Design reference

Exported artboards from the "Crate Digging" design canvas (`canvas.json` lists them):

1. `Main.dc.html`: desktop homepage, the crate
2. `NowPlaying.dc.html`: desktop Now Playing (Baur)
3. `LinerNotes.dc.html`: desktop liner notes (Baur)
4. `MobileHome.dc.html`: mobile homepage
5. `MobileNowPlaying.dc.html`: mobile Now Playing sheet (Baur)

`crate-digging-design-source.zip` is the original export.

These files are **reference only**. They load fonts from the Google Fonts CDN and use inline styles; the real site self-hosts its fonts and is rebuilt from components. Match the look, never copy the markup wholesale. They are excluded from the build, Prettier and TypeScript.
