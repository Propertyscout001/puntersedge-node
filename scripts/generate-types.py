#!/usr/bin/env python3
"""Generate src/types.generated.ts from the live OpenAPI schema.

WHY THIS IS GENERATED. The response shapes are wide — NextRaceOut alone carries 20+ race
fields plus nested runners, bookmaker quotes and scratchings — and they change whenever the
API ships a field. Hand-typing them guarantees the SDK's types drift from the server's, and
a TypeScript type that lies is worse than no type at all: it type-checks the wrong thing.

    python3 scripts/generate-types.py            # reads the live schema
    python3 scripts/generate-types.py openapi.json

Only `components.schemas` is generated. The client surface in src/client.ts is hand-written,
because method names, grouping and which endpoints a customer should see are editorial
decisions an emitter cannot make.

Admin-only schemas (ingest payloads, key creation, signup) are skipped — see SKIP below.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request

SPEC_URL = "https://api.puntersedge.online/openapi.json"
OUT = "src/types.generated.ts"

# Request/response bodies for endpoints the SDK deliberately does not expose: price
# ingestion is for our own scrapers, key creation is admin-only, signup belongs to the
# website's checkout flow. Emitting them would advertise a surface customers cannot call.
SKIP = {
    "IngestPayload", "SportIngestPayload", "RaceIn", "RunnerIn", "MarketIn",
    "SelectionIn", "SportEventIn", "SignupRequest",
    "HTTPValidationError", "ValidationError",  # hand-written in errors.ts, richer there
    "Problem",  # hand-written in errors.ts, where the error classes that carry it live
}

RESERVED = {"from", "function", "class", "default", "in", "new", "delete", "for"}


def ts_name(name: str) -> str:
    """OpenAPI component name -> exported TS name. `NextRaceOut` stays `NextRaceOut`."""
    return name


def prop_key(name: str) -> str:
    """Quote a property name unless it is a plain identifier."""
    if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", name) and name not in RESERVED:
        return name
    return json.dumps(name)


def doc_block(text: str, pad: str) -> list[str]:
    """A JSDoc comment, wrapped. Several field descriptions run to a full paragraph — the
    acceptances counts spend 200 words each explaining when a figure is a floor rather than
    an exact count. That prose is the reason the field is safe to use, so it is kept whole
    and wrapped, not truncated."""
    words = " ".join(text.split())
    if not words:
        return []
    if len(words) <= 92:
        return [pad + "/** %s */" % words]
    lines, cur = [], ""
    for w in words.split(" "):
        if cur and len(cur) + 1 + len(w) > 92:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return [pad + "/**"] + [pad + " * " + ln for ln in lines] + [pad + " */"]


def render_type(schema: dict, schemas: dict, depth: int = 0) -> str:
    """One OpenAPI schema node -> one TypeScript type expression."""
    if schema is None:
        return "unknown"

    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        return ts_name(ref) if ref not in SKIP else "unknown"

    # FastAPI emits Optional[X] as anyOf[X, null]; collapse that to `X | null`.
    for combiner in ("anyOf", "oneOf"):
        if combiner in schema:
            parts = [render_type(s, schemas, depth + 1) for s in schema[combiner]]
            # dedupe while preserving order
            seen, out = set(), []
            for p in parts:
                if p not in seen:
                    seen.add(p)
                    out.append(p)
            return " | ".join(out) if out else "unknown"

    if "allOf" in schema:
        parts = [render_type(s, schemas, depth + 1) for s in schema["allOf"]]
        return " & ".join(parts) if parts else "unknown"

    if "const" in schema:
        return json.dumps(schema["const"])

    enum = schema.get("enum")
    if enum:
        return " | ".join(json.dumps(v) for v in enum)

    t = schema.get("type")

    if isinstance(t, list):  # JSON Schema union of primitives
        return " | ".join(render_type({"type": x}, schemas, depth + 1) for x in t)

    if t == "array":
        inner = render_type(schema.get("items"), schemas, depth + 1)
        # `A | B[]` would parse as `A | (B[])`; parenthesise unions before the [].
        if " | " in inner or " & " in inner:
            inner = "(" + inner + ")"
        return inner + "[]"

    if t == "object" or ("properties" in schema):
        props = schema.get("properties")
        if not props:
            extra = schema.get("additionalProperties")
            if isinstance(extra, dict):
                return "Record<string, %s>" % render_type(extra, schemas, depth + 1)
            return "Record<string, unknown>"
        required = set(schema.get("required", []))
        pad = "  " * (depth + 1)
        lines = []
        for pname, pschema in props.items():
            lines.extend(doc_block(pschema.get("description") or "", pad))
            opt = "" if pname in required else "?"
            lines.append("%s%s%s: %s;" % (pad, prop_key(pname), opt,
                                          render_type(pschema, schemas, depth + 1)))
        return "{\n" + "\n".join(lines) + "\n" + "  " * depth + "}"

    return {
        "string": "string",
        "integer": "number",
        "number": "number",
        "boolean": "boolean",
        "null": "null",
    }.get(t, "unknown")


def main() -> None:
    if len(sys.argv) > 1:
        spec = json.load(open(sys.argv[1]))
        source = sys.argv[1]
    else:
        with urllib.request.urlopen(SPEC_URL, timeout=60) as r:
            spec = json.loads(r.read().decode())
        source = SPEC_URL

    schemas = spec["components"]["schemas"]
    version = spec["info"].get("version", "?")

    out = [
        "// GENERATED FILE — do not edit by hand.",
        "//",
        "// Source:  %s (API version %s)" % (source, version),
        "// Rebuild: python3 scripts/generate-types.py",
        "//",
        "// Every interface below mirrors one `components.schemas` entry of the PuntersEdge",
        "// OpenAPI document. A field marked optional here is one the API declares optional:",
        "// racing data is scraped from bookmakers that each publish a different subset, so",
        "// `barrier?: number` means some books genuinely do not report a barrier, not that",
        "// the schema is sloppy. Check before you read.",
        "",
        "/* eslint-disable */",
        "",
    ]

    for name in sorted(schemas):
        if name in SKIP:
            continue
        schema = schemas[name]
        out.extend(doc_block(schema.get("description") or "", ""))
        body = render_type(schema, schemas, 0)
        if body.startswith("{"):
            out.append("export interface %s %s" % (ts_name(name), body))
        else:
            out.append("export type %s = %s;" % (ts_name(name), body))
        out.append("")

    with open(OUT, "w") as f:
        f.write("\n".join(out))
    print("wrote %s (%d schemas)" % (OUT, len([n for n in schemas if n not in SKIP])))


if __name__ == "__main__":
    main()
