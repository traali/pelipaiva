# Pelipäivä Family Sync — Architecture Plan
Version: 1.0
Date: 2026-08-23
Status: approved direction (B+A), not yet implemented
Product: Pelipäivä PWA — https://pelipaiva.pages.dev
Repo: https://github.com/traali/pelipaiva  (branch: main)

## 1. One-sentence goal

When one parent adds a child, team or cup, every family phone shows the
same roster. Matches are not copied. Each phone loads them from
tulospalvelu using the shared team URL.

## 2. What exists today (gap)

| Piece | Today | Gap |
|---|---|---|
| Dexie `PelipaivaDB` | Local profiles, events, officialFixtures | Per browser only |
| `?share=` QR | Stubs: id, playerName, teamName, sport, calendarUrl, colorHex | No teamId, no associationUrl, no season query, no ingest |
| JSON backup v2 | profiles + arrivalRules + aliases + pins | No events, manual file |
| Worker `MATCHDAY_KV` | PUT `/api/sync/:key` (≥16 chars, 7d TTL) for Nest Hub | No GET for family, no 6-char code |
| ICS proxy | GET `/api/proxy/ics?url=` | Keep as-is |
| WhatsApp | Generated talkoo / post-match / logistics lines; paste-parse in Quick Drop | No family-join template, no `?perhe=` |
| Identity | `profile-${Date.now()}` | Two phones mint two ids for the same child+URL |

### Constitution (do not break):
- Zero auth / no family login
- Dexie remains source of truth on the device
- No product LLM
- No kids’ medical / injury / nimenhuuto secrets in the cloud
- Offline hall must still render the HUD from Dexie

## 3. Architecture (winner: B bus + A hydrate)

Cloudflare stores **who plays where**.  
Tulospalvelu stores **when and against whom**.

## 4. What is stored where

### 4.1 Cloudflare KV — `family:{CODE}` (~2 KB)

```ts
interface FamilyRosterV1 {
  v: 1;
  rev: number;                 // monotonic, If-Match
  updatedAt: string;           // ISO
  profiles: FamilyRosterRow[];
  tombstones: Array<{ id: string; deletedAt: string }>;
}

interface FamilyRosterRow {
  id: string;                  // stable: see §5
  playerName: string;          // first name only
  teamName: string;
  sport: SportType;
  colorHex: string;
  calendarUrl: string;         // RAW url, keep ?season=hc2026&category=B13-8
  associationUrl?: string;
  associationType?: string;
  teamId?: string;
}
```

### 4.2 Local Storage / Dexie
- `syncKey`: 'SAIMA-4'
- `lastSyncedAt`: ISO
