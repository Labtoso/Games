# Website pool for "What does it sell?"

This folder builds the pool of real websites used by the guessing game (`games/guess`).
It runs as the GitHub Action `Refresh guessing pool` every Monday, on every change to this
folder, and by hand from the Actions tab. Nothing here is shipped with the site.

## What a run does

1. Reads the current pool from the `pool` branch, drops entries that are on the removal list,
   then retires the oldest 15 % so the pool keeps changing.
2. Picks candidate domains from the [Tranco list](https://tranco-list.eu/), spread over all
   ranks (12 % from the top 2,000, 28 % up to rank 20,000, 35 % up to 200,000, 25 % below), one
   domain per brand.
3. Opens each homepage in Chromium at 1280×800, clicks away cookie banners (reject first, accept
   otherwise), hides leftover overlays and takes a screenshot.
4. Keeps a site only if all checks pass (see below), files it under one category from
   `taxonomy.mjs`, and saves the screenshot as a 1024×640 WebP (about 30–50 KB) under a random id.
5. Writes the pool to the `pool` branch as a single commit and redeploys the site. The game reads
   it from `/pool/` on games.labtoso.de and never contacts the websites themselves.

Target size is 3,300 sites, about 130 MB of screenshots.

## Filters

A candidate is dropped when:

- its domain or redirect target is on the StevenBlack hosts list (adware, malware, fake news,
  gambling, adult) or the URLhaus malware list;
- the domain, title or description contains a word from `BLOCK_WORDS` (adult, gambling, drugs,
  weapons, hate, scams);
- it looks like infrastructure (`cdn`, `api`, `static` and so on), a government or military site;
- the page is parked, an error, a bot check, a login, a cookie wall or almost empty
  (`JUNK_WORDS`, less than 250 characters of text, a nearly blank screenshot);
- it looks like a personal page (`PERSONAL_WORDS`);
- it is not in English, has no description, or no category wins clearly.

## Data format (`pool` branch)

- `meta.json`: `{ v, updated, count, shards, sizes, removed, byCat }`
- `categories.json`: `[{ id, group, answer, syn }]`
- `i/<n>.json`: one shard per `n` (0–31), entries `{ id, c, r, d, t, a }`:
  `c` category id, `r` rank bucket 0–3 (0 is most known), `d` domain and `t` title
  (XOR 0x5A, base64, so they do not show up in plain text), `a` time added
- `s/<id>.webp`: screenshot

An entry lives in shard `parseInt(id.slice(0, 4), 16) % 32`.

## Removing a site

Add the domain (without `www`) or the pool id to `removal-list.json` and push. The Action runs
on that change, removes the site and redeploys. The game also hides every id listed under
`removed` in `meta.json` right away. Players can ask for removal with the Report button in the
game, which opens a GitHub issue.

## Running it locally

```
npm install
npx playwright install chromium
mkdir -p lists && curl -L -o lists/tranco.zip https://tranco-list.eu/top-1m.csv.zip && unzip lists/tranco.zip -d lists
node build.mjs --out out --target 50
```

`--old <dir>` continues from an existing pool, `--concurrency`, `--minutes` and `--local <url>`
(load `<url><domain>.html` instead of the real site) help with testing.

The Action splits the work over 8 runners: `--part <i> --parts 8` collects one slice of the
Tranco list into `<out>/fresh.json` plus screenshots, and `--merge dirA,dirB,...` joins the
slices with the old pool. Only about one site in eighteen passes all filters, so a single runner
cannot reach 3,000 in its time limit. Every page has a hard 45 s limit and the browser is
restarted every 400 pages or after a run of timeouts.
