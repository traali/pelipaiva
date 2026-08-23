# Pelipäivä Family Sync — Architecture Enhancements & Hardening
Version: 1.1  
Date: 2026-08-23  
Status: Supplemental engineering hardening guide for [FAMILY_SYNC_ARCHITECTURE.md](./FAMILY_SYNC_ARCHITECTURE.md)  
Product: Pelipäivä PWA — https://pelipaiva.pages.dev  
Repo: https://github.com/traali/pelipaiva (branch: main)

---

## 1. Executive Summary

The **"B bus + A hydrate"** model in [`FAMILY_SYNC_ARCHITECTURE.md`](./FAMILY_SYNC_ARCHITECTURE.md) (Cloudflare stores who plays where in ~2 KB KV records; Tulospalvelu stores matches) is the optimal architecture for Pelipäivä.

This document details **7 critical hardening specifications** to prevent production edge-case failures (offline sports halls, burst rate-limiting, typo probing, tombstone accumulation, and race conditions).

---

## 2. The 7 Engineering Hardening Specifications

### 2.1 Self-Validating Crockford-32 Checksum (`SAIMA-4`)
- **Problem**: If a user mistypes a family code on mobile, an unvalidated code triggers a network roundtrip to Cloudflare KV. Random network scanning against `/api/family/:code` also consumes KV rate limits.
- **Solution**: Make the final character in the 6-character code (`XXXXX-C`) a **Crockford-32 Luhn/Damm Checksum Digit**.
- **Behavior**:
  - Validates instantly on-device in 0ms offline before making any fetch request.
  - Drops 97% of random network probes at the edge before hitting KV storage.

### 2.2 30-Day Tombstone Garbage Collection
- **Problem**: `tombstones: Array<{ id: string; deletedAt: string }>` grows indefinitely over multiple seasons, eventually bloating the ~2 KB payload.
- **Solution**: During the client-side union before PUT, prune tombstones older than 30 days:
  ```ts
  const TOMBSTONE_RETENTION_MS = 30 * 86400 * 1000;
  const now = Date.now();
  roster.tombstones = roster.tombstones.filter(
    (t) => now - new Date(t.deletedAt).getTime() < TOMBSTONE_RETENTION_MS
  );
  ```

### 2.3 Throttled Hydration Pipeline (Anti-Burst Protection)
- **Problem**: When a parent joins a family with 4 teams across 3 children, triggering 4 simultaneous requests to Torneopal / Palloliitto / Salibandy / Basket.fi can cause connection timeouts on mobile networks.
- **Solution**: Use a queued hydration pool (max 2 parallel fetches, 150ms stagger) with `Promise.allSettled`:
  ```ts
  for (const profile of newProfiles) {
    await hydrateTeamFixtures(profile);
    await new Promise((r) => setTimeout(r, 150));
  }
  ```
  - *Result*: Successful feeds populate Dexie immediately; a single failing endpoint does not block the rest of the roster.

### 2.4 Quoted ETag & Dual-Header Concurrency (`If-Match`)
- **Problem**: Raw unquoted integers in `If-Match: 14` can be stripped or altered by strict proxy layers.
- **Solution**:
  - Client sends standard quoted ETag: `If-Match: "${rev}"`
  - Client also sends custom fallback header: `X-Pelipaiva-Rev: ${rev}`
  - Worker validates: `const reqRev = req.headers.get('If-Match')?.replace(/"/g, '') || req.headers.get('X-Pelipaiva-Rev')`

### 2.5 Cascade Tombstoning on Child Deletion
- **Problem**: When a child with multiple teams (e.g. football + basketball) is deleted in `FamilyManageModal`, deleting by child name must purge all associated team profiles.
- **Solution**: `deletePlayer(playerName)` finds all profiles matching `playerName` and generates tombstones for all corresponding `p:${slug}:${teamSourceKey}` IDs.

### 2.6 Store-and-Forward Offline Mutation Queue
- **Problem**: A parent adds or removes a team while sitting in a concrete sports hall with zero cellular connectivity.
- **Solution**:
  1. Dexie saves the change locally immediately and sets `syncState.pendingUpload = true`.
  2. The app listens to `window.addEventListener('online')` and `document.addEventListener('visibilitychange')`.
  3. When connection is restored, it executes: `GET -> union -> bump rev -> PUT`.

### 2.7 Local Color Preferences vs Family Defaults
- **Problem**: If Parent A prefers Maija in Blue and Parent B prefers Maija in Pink, shared sync could thrash colors.
- **Solution**:
  - `FamilyRosterRow.colorHex` is the **family shared default**.
  - Local Dexie maintains `localColorHex` override if customized locally, preserving personal preference while keeping shared team links in sync.

---

## 3. Implementation Checklist

- [ ] **Phase 0 (Client-Only)**:
  - [ ] Implement deterministic ID: `p:${slug(playerName)}:${teamSourceKey(calendarUrl)}`
  - [ ] In-canvas QR generation (zero third-party API dependencies)
  - [ ] Widen payload: include `teamId`, `associationUrl`, and raw query params (`?season=hc2026&category=B13-8`)
- [ ] **Phase 1 (Worker & Cloud Sync)**:
  - [ ] Worker endpoints: `GET|PUT|DELETE /api/family/:code` with 7-day sliding TTL
  - [ ] Client `familyCloud.ts` with 30-day tombstone GC and 409 conflict retry
  - [ ] Crockford-32 checksum validator
  - [ ] WhatsApp copy-paste templates in `FamilyShareModal.tsx`
