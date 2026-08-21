# MultiMediaPicker

An Equicord **userplugin** that adds a provider dropdown to the right of the
search bar in Discord's own GIF picker. Pick Pinterest, PicsArt, Openverse or
Wikimedia Commons and the same picker grid fills with those results instead.

There is no extra button and no extra tab. Discord's picker renders everything.

## How it works

The plugin does not draw a grid. It intercepts the GIF picker's own fetches and
feeds Discord its own results:

- `renderHeader()` returns a flex row whose children are the clear button and
  `this.renderHeaderContent()`. The first patch appends the provider dropdown as
  a third child.
- `GIFS_SEARCH` and `GIFS_TRENDING_GIFS` requests are short-circuited while a
  non-Discord provider is selected. The plugin fetches from that provider,
  reshapes the results into Discord's `DiscordGif` records, and dispatches
  `GIF_PICKER_QUERY_SUCCESS`.

Because Discord's own components render the grid, selection, sending, favourites
and keyboard navigation all keep working untouched.

All three patch regexes were verified against Discord's live `web.js` bundle
(build fetched 2026-08-21): each matches exactly once.

## Install

Userplugins only load in a **source build**. A prebuilt `.asar` from an installer
cannot load them.

Works on both Equicord and Vencord. Verified by building inside upstream Vencord
`ef29bbe`: zero type errors, and `patches/csp-allowlist.patch` applies cleanly
there too.

Requires Node 20+, pnpm and git.

```bash
git clone https://github.com/Equicord/Equicord
```

```bash
cd Equicord && corepack enable && pnpm install
```

```bash
git clone https://github.com/BloodShelll/MultiMediaPicker /tmp/mmp && mkdir -p src/userplugins/multiMediaPicker && cp /tmp/mmp/src/* src/userplugins/multiMediaPicker/ && git apply /tmp/mmp/patches/csp-allowlist.patch
```

```bash
pnpm build && pnpm inject
```

Substitute `https://github.com/Vendicated/Vencord` in the first command for a
Vencord build. Then quit Discord completely, start it again, and enable
**MultiMediaPicker** under Settings then Plugins.

## Providers

| Provider | Needs a key? | Notes |
|---|---|---|
| **GIFs** | No | Passthrough. Discord's own search, untouched, whichever backend it uses (Tenor on older clients, Klipy on newer). |
| **Pinterest** | No | Public web resource endpoint, works with no cookies and no login. |
| **PicsArt** | No | `api.picsart.com` photo search. Thumbnails use the CDN resize param (`?type=webp&to=min&r=240`), ~10 KB instead of ~320 KB. |
| **PicsArt Stickers** | No | Same API, transparent PNG cutouts. |
| **Openverse** | No | Official open API, CC-licensed images. Anonymous requests are capped at `page_size=20`; asking for more returns `401 page_size may not exceed 20 for anonymous requests`. |
| **Wikimedia** | No | Commons `File:` namespace search. |
| **Giphy** | **Yes** | Stays out of the dropdown until a key is set. The old public demo key `dc6zaTOxFJmzC` now returns `403 BANNED`. |

Pinterest and PicsArt are unofficial endpoints, verified working 2026-08-21.
They are not contracts — if either site changes its web API that one provider
breaks and the rest keep working.

Two request details found by testing rather than from documentation:

- Pinterest returns `403 Invalid Resource Request` unless the `options` object
  carries every field its web client sends. A trimmed payload is rejected even
  though the extra fields are all nulls and defaults.
- Wikimedia needs `gsrnamespace=6`. Without it the generator searches articles
  instead of files and comes back empty, not an error.

## Layout

```
index.tsx           patches, result reshaping, Flux dispatch
ProviderSelect.tsx  the dropdown
state.ts            which provider is active
search.ts           dispatch: Discord GIFs in the renderer, the rest -> native
native.ts           main process, all fetching and parsing
settings.ts         plugin settings
types.ts            shared plain types, imported by both sides
styles.css          managed stylesheet
```

Discord's renderer runs under a CSP that blocks `pinterest.com`, `picsart.com`
and `openverse.org`, so all of that fetching happens in `native.ts` in the
Electron main process. Only a normalised `MediaItem[]` crosses IPC.

## Required CSP change

Discord's renderer runs under a Content Security Policy that decides which hosts
may be loaded as images. Fetching the results through `native.ts` gets around the
network restriction, but the returned URLs still have to be displayable, and a
blocked host renders as an empty tile of the right size rather than an error.

`i.pinimg.com` already ships in Equicord's allowlist. The rest do not, so add
them to `src/main/csp/index.ts` next to the existing Pinterest line:

```ts
"*.picsart.com": ImageSrc,
"upload.wikimedia.org": ImageSrc,
"api.openverse.org": ImageSrc,
"*.giphy.com": ImageSrc,
```

The runtime API (`VencordNative.csp.requestAddOverride`) is not usable here: it
stores one exact host from `new URL(url).host`, and PicsArt rotates its CDN
subdomain per image (`cdn270`, `cdn271`, ...), so only a wildcard entry works.

This is a main process file. Editing it needs a full Discord restart, not Ctrl+R.

## Settings

- **Default provider** — which provider the picker starts on.
- **Mature content** — hide or show results PicsArt flagged as adult. Only
  PicsArt reports this flag, so it cannot filter the others.
- **Giphy API key** — optional, adds Giphy to the dropdown.

## Rebuilding after an edit

```bash
pnpm build
```

Then Ctrl+R in Discord. Editing `native.ts` needs a full Discord restart,
because the main process only loads it at startup.

## Notes

- `authors` uses an inline entry rather than `Devs`/`EquicordDevs`, which the
  repository rules require. There is no way around that for a userplugin whose
  author is not in the shared constants.
- Upstreaming: Equicord's plugin policy rules this out as-is, since it excludes
  anything relying on user-supplied API keys or untrusted third-party endpoints.
  Vencord's rules are narrower — they bar *self hosted* third party APIs and
  plugins that *require* a user API key. Pinterest and PicsArt are neither self
  hosted nor required-key, and the Giphy tab is optional and hidden by default,
  so a Vencord submission is not ruled out on its face. It would still need the
  Giphy tab dropped, `authors` moved to `Devs`, and the CSP hosts folded into the
  same PR. Their CONTRIBUTING asks you to raise the idea with them before
  opening a PR, which is the right first step.
- `TenorGifSearch` patches the same two fetch functions. Do not run both.
