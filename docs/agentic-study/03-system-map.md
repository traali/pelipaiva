# 03 — System map

## What we know

```mermaid
flowchart LR
  subgraph actors
    P[Parent phone]
    L[Laptop Chrome]
    OP[Operator CF dashboard]
  end
  subgraph surfaces
    PWA[PWA React Vite]
    ICS[webcal Pages /api/calendar]
  end
  subgraph app
    DEX[(Dexie PelipaivaDB)]
    GRAPH[runMissionControlGraph]
    NLP[messageParserNLP]
    LLM[opt-in LanguageModel / native stub]
  end
  subgraph edge
    PAGES[CF Pages pelipaiva]
    FN[Pages Function calendar]
    W[Worker pelipaiva-edge]
    KV[(MATCHDAY_KV family:CODE)]
  end
  subgraph vendors
    FED[Palloliitto Salibandy Basket Torneopal]
    CAL[Nimenhuuto MyClub Jopox]
    GEO[LIPAS hel.fi Nominatim]
    WX[FMI]
  end
  P --> PWA
  L --> PWA
  PWA --> DEX
  DEX --> GRAPH
  PWA --> NLP
  NLP -.-> LLM
  PWA --> PAGES
  PWA -->|family GET/PUT| W
  PWA -->|proxy ics| W
  ICS --> FN --> W
  W --> KV
  W --> FED
  W --> CAL
  W --> GEO
  W --> WX
  OP -->|FAMILY_CODES secret| W
```

## Packages

| Unit | Runtime | Role |
|---|---|---|
| `src/` | Browser | Product |
| `cloudflare-worker/` | CF Worker | Proxy + family + ICS merge |
| `functions/api/` | Pages Functions | Calendar host alias |
| `native/ios/` | Unshipped | Core AI bridge stub |

## Env matrix

| Env | Frontend | Worker | FAMILY_CODES |
|---|---|---|---|
| Local | vite :3000 | UNKNOWN unless wrangler dev | empty → 403 |
| Prod | pelipaiva.pages.dev | pelipaiva-edge.sakkoja.workers.dev | dashboard secret |
| Staging | none in repo | none | — |

## What we infer
Single-tenant-per-device, multi-device via issued codes (max ~10).

## What we do not know
Whether `pelipaiva.fi` DNS is live (CORS lists it).
