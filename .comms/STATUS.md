# WOLVES - Status

## Phase actuelle : S1 - Fondations (fork BETLY)
**Date debut :** 2026-04-18

## Infrastructure
- [x] Fork BETLY vers /Users/aifactory/wolves/
- [x] Nettoyage agents/models BETLY
- [x] 6 models Mongoose WOLVES
- [x] API minimale (/health, /matches, /characters, /events)
- [x] Socket.io integre
- [x] AgentRuntime + llmRouter (Haiku V1)
- [x] 3 personnages test (Thesee, Lyra, Orion)
- [x] Script test 3 agents x 5 tours
- [ ] Test live avec ANTHROPIC_API_KEY

## Blockers
| # | Issue | Severite | Action |
|---|-------|----------|--------|
| P1-1 | ANTHROPIC_API_KEY necessaire pour test:agents | BLOQUE test live | Nel: creer .env avec cle |

## Semaine 1 Roadmap
| Jour | Focus | Statut |
|------|-------|--------|
| J1-2 | Fork + nettoyage + models | DONE |
| J3   | Socket.io | DONE |
| J4-5 | AgentRuntime + test | DONE (en attente API key) |
