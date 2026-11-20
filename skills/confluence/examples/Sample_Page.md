# Confluence round-trip example

This is a fictional example. Use it to check that tables, images, callouts, code and macros survive both directions.

````text
---
title: "Store API overview"
confluence:
  base_url: "https://example.atlassian.net/wiki"
  page_id: "123456789"
  space_key: "DOCS"
  version: 7
  url: "https://example.atlassian.net/wiki/spaces/DOCS/pages/123456789/Store+API+overview"
  parent_id: "123456"
  labels: [api, store]
attachments:
  - filename: "orders-flow.png"
    media_type: "image/png"
    local_path: "attachments/orders-flow.png"
---

# Store API overview

The Store API accepts orders and publishes an event after payment confirmation.

> [!NOTE]
> All requests require a bearer token.

## Order flow

![Order flow](attachments/orders-flow.png)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `customer_id` | string | yes | Customer identifier |
| `items` | array | yes | At least one item |
| `coupon` | string | no | Optional coupon code |

```http
POST /orders
Authorization: Bearer <token>
```

<details>
<summary>Error response</summary>

```json
{"error": "PAYMENT_DECLINED"}
```

</details>

```xml confluence-macro
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
</ac:structured-macro>
```
````

The corresponding storage body keeps the title, note macro, attached image, table, code macro, expand macro and TOC macro. The `confluence-macro` block is a preservation block, not visible content: publishing replaces it with the original macro XML after validation.
