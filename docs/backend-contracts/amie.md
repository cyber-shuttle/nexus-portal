# Backend contract — AMIE packet console

Placeholder. Phase 6 ships the AMIE admin console and finalizes this contract.
Source of truth for the packet/event/audit shape: `airavata-custos/connectors/
ACCESS/AMIE-Processor/model/`.

Spec §10.3 enumerates the expected HTTP surface:

```
GET  /amie/packets?status&type&source&from&to&limit&offset → PacketList
GET  /amie/packets/{id}                                     → Packet (full)
GET  /amie/packets/{id}/events                              → Event[]
POST /amie/packets/{id}/retry                               → { queued: true }
POST /amie/packets/{id}/resolve  body: { reason }           → Packet
GET  /amie/replies?status&from&to&limit&offset              → ReplyList
POST /amie/replies/{id}/retry                               → { queued: true }
GET  /amie/unmapped?limit&offset                            → PacketList
POST /amie/unmapped/{id}/link    body: { entityType, entityId }
GET  /amie/stats?window=30d                                 → { byDay: [{ date, status, type, count }] }
```

TBD: pagination scheme (offset vs cursor), retry payload shape, audit entry
shape. Phase 6 negotiates this with the AMIE-Processor team.
