import json
d = json.load(open("openapi-snapshot.json"))
paths = d["paths"]
print("=== ASSETS endpoints ===")
for p in sorted(paths):
    if "/assets" in p:
        for method, op in paths[p].items():
            print(f"{method.upper()} {p}")
            params = [prm.get("name") for prm in op.get("parameters", [])]
            if params: print(f"  params: {params}")
            rb = op.get("requestBody", {}).get("content", {})
            for ctype, schema in rb.items():
                print(f"  body ({ctype}): {json.dumps(schema.get('schema', {}))[:200]}")
            for code in ("200", "201", "204"):
                r = op.get("responses", {}).get(code)
                if r:
                    s = r.get("content", {}).get("application/json", {}).get("schema", {})
                    print(f"  {code}: {json.dumps(s)[:200]}")

print()
print("=== DEPOSITS endpoints (may be related) ===")
for p in sorted(paths):
    if "/deposits" in p:
        for method, op in paths[p].items():
            print(f"{method.upper()} {p}")

print()
print("=== Asset/Deposit/BuyIn/Refund schemas ===")
s = d["components"]["schemas"]
for name in sorted(s):
    if any(k in name for k in ["Asset", "Deposit", "BuyIn", "Refund", "Contribution"]):
        print(f"  {name}")
