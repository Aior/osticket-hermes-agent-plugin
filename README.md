# osTicket Hermes Agent Plugin

Fork of [`sitkowsp/osT-TTW`](https://github.com/sitkowsp/osT-TTW), adapted for the Pearl/MacWay Hermes Agent workflow on **osTicket 1.18.x**.

The plugin keeps the useful base behaviour from osT-TTW — outbound JSON webhook on `ticket.created`, department filtering, Basic Auth, custom headers, reverse-proxy DNS override — and adds the Hermes-specific loop plus optional `ticket.client_reply` follow-up events:

1. osTicket creates a ticket, or a requester/collaborator adds a follow-up message.
2. The plugin sends a short-timeout JSON webhook to Hermes Agent.
3. Hermes analyses the ticket asynchronously.
4. Hermes calls back osTicket on `POST /api/http.php/hermes/note`.
5. The plugin adds Hermes' proposal as an **internal note only**.

It never sends an automatic reply to the customer.

## Requirements

- osTicket **1.18.x** — validated against the 1.18.2 source API
- PHP **7.4+**
- PHP cURL extension (`php-curl`)
- One active plugin instance with a shared secret

## Installation

Clone or copy this repository into your osTicket plugin directory:

```bash
cd /path/to/osticket/include/plugins
git clone https://github.com/Aior/osticket-hermes-agent-plugin.git osticket-hermes-agent-plugin
```

Expected structure:

```text
include/plugins/osticket-hermes-agent-plugin/
├── plugin.php
└── include/
    └── class.ticket-webhook.php
```

Then in osTicket:

1. **Admin Panel > Manage > Plugins > Add New Plugin**
2. Install **Hermes Agent Ticket Webhook**
3. Open the plugin and add an **active instance**
4. Configure the fields below

## Configuration

### Webhook Settings

| Field | Description |
|---|---|
| **Enable Webhook** | Master on/off toggle for this instance. |
| **Send Client Replies** | Also send `ticket.client_reply` when a requester/collaborator replies to an existing ticket. Staff responses and internal notes are ignored. |
| **Hermes Webhook URL** | Endpoint that receives outbound `ticket.created` and `ticket.client_reply` events. For Hermes Gateway use `http://<hermes-host>:8644/webhooks/osticket-hermes` (plural `/webhooks/`). |
| **Hermes Shared Secret** | Secret required for the inbound callback. Hermes must send it as `X-Hermes-Secret`. |
| **Internal Note Poster** | Displayed poster for notes created by the callback. Default: `Hermes Agent`. |

### Authentication to Hermes

Optional HTTP Basic Auth for the outbound webhook:

| Field | Description |
|---|---|
| **Username** | Basic Auth username. Leave empty for no Basic Auth. |
| **Password** | Basic Auth password. Stored through osTicket plugin config. |

### Department Filter

| Field | Description |
|---|---|
| **Departments** | Trigger only for selected departments. Empty = all departments. |

### Advanced Settings

| Field | Description |
|---|---|
| **Verify SSL Certificate** | Keep enabled in production. Disable only for test/self-signed endpoints. |
| **Resolve Host Override (IP)** | cURL `CURLOPT_RESOLVE` helper for reverse-proxy / loopback DNS issues. Bare IP only. |
| **Custom Header** | Optional extra outbound header, e.g. `X-Example-Header: value`. |
| **Enable Debug Logging** | Writes `webhook.log` in the plugin directory. Disable after testing. |

## Outbound payload to Hermes

The plugin sends `POST` JSON with `Content-Type: application/json` when a ticket is created, and optionally when the requester/collaborator adds a follow-up message to an existing ticket.

Example shape:

```json
{
  "event": "ticket.created",
  "event_type": "ticket.created",
  "source": "osticket",
  "plugin": {
    "name": "Hermes Agent Ticket Webhook",
    "version": "1.2.0",
    "osticket": "1.18.x",
    "callback": {
      "method": "POST",
      "url": "https://support.example.com/api/http.php/hermes/note",
      "auth": "X-Hermes-Secret"
    }
  },
  "ticket": {
    "id": 1234,
    "number": "ABC-567",
    "subject": "Question produit",
    "status": "Open",
    "priority": "Normal",
    "sla": "Default SLA",
    "source": "Web",
    "due_date": null,
    "created": "2026-05-07 17:30:00",
    "url": "https://support.example.com/scp/tickets.php?id=1234"
  },
  "department": {
    "id": 2,
    "name": "Commercial"
  },
  "requester": {
    "name": "Jane Doe",
    "email": "jane@example.com"
  },
  "message": {
    "id": 555,
    "parent_id": null,
    "title": "Question produit",
    "body": "Bonjour, ...",
    "created": "2026-05-07 17:30:00"
  },
  "thread": [
    {"id": 555, "type": "M", "body": "Bonjour, ..."}
  ],
  "help_topic": "Demande commerciale",
  "assigned_to": null
}
```

For follow-up messages, `event`/`event_type` is `ticket.client_reply`; `message` contains the new requester/collaborator thread entry and `thread` contains the latest entries for context. Internal notes (`N`) and staff responses (`R`) do not trigger outbound calls, preventing Hermes callback loops.

The HTTP call uses short timeouts (`connect=2s`, total `3s`) so ticket creation/reply posting is not blocked for long. Hermes must perform the expensive work asynchronously.

## Inbound Hermes callback

Hermes can create an internal note with:

```bash
curl -X POST 'https://support.example.com/api/http.php/hermes/note' \
  -H 'Content-Type: application/json' \
  -H 'X-Hermes-Secret: <shared-secret>' \
  -d '{
    "ticket_id": 1234,
    "title": "Proposition Hermes Agent",
    "note": "Réponse proposée à relire par un opérateur...",
    "warnings": ["Vérifier la disponibilité ERP avant réponse"],
    "metadata": {"model": "hermes", "confidence": "review_required"}
  }'
```

Accepted body fields:

| Field | Required | Description |
|---|---:|---|
| `ticket_id` | yes | osTicket internal ticket id. Alternative accepted: `ticket.id`. |
| `title` | no | Internal note title. Defaults to `Proposition Hermes Agent`. |
| `note` | yes | Proposal content. Alternatives accepted: `proposal` or `content`. |
| `warnings` | no | Array rendered below the proposal. |
| `metadata` | no | JSON object rendered in a `<pre>` block for audit/debug. |

Responses:

| Status | Meaning |
|---:|---|
| `201` | Internal note created. |
| `400` | Invalid JSON, missing ticket id, or missing note. |
| `401` | Missing `X-Hermes-Secret`. |
| `403` | Secret does not match any active plugin instance. |
| `404` | Ticket not found. |
| `500` | osTicket failed to create the note. |

## Security notes

- Use a long random `Hermes Shared Secret`.
- Prefer HTTPS for both outbound and inbound flows.
- Restrict `/api/http.php/hermes/note` at reverse proxy/firewall level to Hermes IPs if possible.
- The plugin creates **internal notes only** and disables staff alerts for callback notes.
- Do not put API keys in README, logs, screenshots, or commits.

## Troubleshooting

1. Enable **Debug Logging** in the plugin instance.
2. Create a ticket in a monitored department, then add a requester follow-up if testing client-reply triggers.
3. Check `include/plugins/osticket-hermes-agent-plugin/webhook.log`.
4. Check **Admin Panel > Dashboard > System Logs** for outbound webhook failures.
5. Test callback manually with `curl` using a non-sensitive test shared secret.

Common issues:

| Symptom | Cause | Fix |
|---|---|---|
| No outbound call | Plugin disabled, no active instance, department filter mismatch | Check plugin + instance status and department selection |
| `curl_init()` missing | PHP cURL extension absent | Install `php-curl` for the PHP version used by the web server |
| Callback returns `401` | Missing header | Send `X-Hermes-Secret` |
| Callback returns `403` | Wrong secret or inactive instance | Verify active instance and shared secret |
| Callback returns Apache `404` on `/api/hermes/note` | Pretty API rewrites are not enabled or osTicket is installed in a subdirectory | Use the explicit front-controller URL `/api/http.php/hermes/note` |
| Callback returns `404` | Hermes used ticket number instead of internal id | Use `ticket.id`, not `ticket.number` |
| SSL/SNI errors | Reverse-proxy loopback | Use internal Hermes URL or Resolve Host Override |

## License

MIT, inherited from the upstream project.
