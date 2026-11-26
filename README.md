# IPL Auction Room

A browser-based mock IPL auction with two real-season modes: the **2025 mega auction** (207 players from the 2025 squads) and the **2027 mini auction** (official team purses, 66 slots, published retentions/releases and no RTM).

## Modes

- **2025 Mega:** seven real sets, ₹120 Cr purse, RTM cards and a 25-player squad cap.
- **2027 Mini:** real 17 Nov 2026 retention/trade lists and official remaining purses/slots from iplt20.com, 105 released players in the auction pool and no RTM.
- **Single player:** you run one franchise; nine AI franchises bid against you.
- **Multiplayer:** host creates a room, shares the code, and up to ten players join as different franchises. Bids, chat, timer and squads sync live.

The 2027 final auction shortlist was not published at the time of writing. The pool uses released players from the published 2026 squads plus the 29 names from the supplied ₹2 Cr base-price image. Those 29 are marked with a ✓ in the UI; every other released player has a clearly labelled estimated base. All 14 official traded players (Liam Livingstone, Jack Edwards, Rishabh Pant, Zeeshan Ansari, Harshal Patel, Kuldeep Yadav, Sam Curran, Arshdeep Singh, Hardik Pandya, Mohammad Shami, Manimaran Siddharth, Thangarasu Natarajan, Khaleel Ahmed and Nathan Ellis) are locked into their new squads and excluded from the auction. The 16 Dec 2026 event details and team purses are real.

## Run

### Single player only

Open `public/index.html` directly in a browser. No server or install is needed.

### Multiplayer

From this folder:

```bat
npm start
```

Then open:

```text
http://localhost:4173
```

To let friends on the same Wi-Fi/LAN join, open the **phone URL printed in the terminal** by the server, for example:

```text
http://10.207.165.148:4173
```

Do **not** use `localhost` on the phone — `localhost` means the phone itself. Both devices must be on the same Wi-Fi, and the computer must stay awake with the terminal open. If the phone still cannot connect, allow port **4173** inbound in Windows Firewall (or allow `node.exe`).

Set `PORT` to change the port, for example `set PORT=5000 && npm start` on Windows.

### GitHub Pages (solo mode anywhere)

The static site is published at:

```text
https://aritrachandra593-cell.github.io/ipl-auction/
```

Pages serves the `docs/` folder, which is a copy of `public/`. After changing frontend files, run `npm run sync:pages` and commit the `docs/` changes. Multiplayer needs the Node server, so it only works through `npm start` or a deployed backend.

## Player photos

Photos are downloaded once into `public/images/players` and indexed in `public/player-images.js`. The app works offline with those local files. Photos come from Wikipedia/Wikimedia Commons where freely available, then official iplt20.com team squad thumbnails, then ESPNcricinfo headshots for the remaining names. Players with no available photo show initials instead.

To refresh the photo set:

```bat
node tools/fetch-player-images.js
node tools/fetch-ipl-player-images.js
node tools/fetch-wikipedia-missing.js
node tools/fetch-espn-missing.js
```

Attribution and license are shown under the current player and in each image tooltip. Source pages are linked in `public/player-images.js`. Official IPL and ESPN images are credited to their owners and are used here in a non-commercial fan demo.

## Features

- Two season modes selectable on the home screen: 2025 mega auction and 2027 mini auction
- 207 real IPL 2025 players with role, tier, country, former franchise and mock auction base price
- 105 released players in the 2027 pool: 29 confirmed ₹2 Cr base names from the supplied image, 76 estimated bases; all 14 traded/retained players excluded; real per-team purses, slots and overseas limits from the IPL site
- Seven real auction sets: M1 marquee, M2 marquee, batters, all-rounders, wicketkeepers, fast bowlers and spinners; marquee players start at the real ₹2 Cr base price
- Local player photos from Wikipedia/Wikimedia Commons, official iplt20.com squad pages and ESPNcricinfo, with initials fallbacks and visible photo credit
- Real IPL 2025 rules: ₹120 Cr auction purse, 25-player squad cap and 8-overseas limit per team
- Real IPL 2025 team prize money shown at auction end: winner ₹20 Cr, runner-up ₹12.5 Cr, third ₹7 Cr, fourth ₹6.5 Cr
- Live bid timer, bid increments, sold/unsold feed, RTM cards, filterable set-by-set player list and final squads
- Force next clearly logs a skip at base price or a sale at the current bid; the bid panel always shows the active player's base price
- AI bidding with Easy / Standard / Tough difficulty
- Host controls: pause, resume, force next player, reset auction
- Live room chat and automatic host handover when the host disconnects

© 2026 aritracreatives. All rights reserved. Player photos retain their original source credits.

Player names are real; prices, ratings and auction outcomes are for mock-draft entertainment.
