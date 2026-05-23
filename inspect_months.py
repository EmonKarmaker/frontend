import json
d = json.load(open("openapi-snapshot.json"))
paths = d["paths"]
for p in sorted(paths):
    if "/months" in p or "/settlements" in p:
        for method, op in paths[p].items():
            print(f"=== {method.upper()} {p} ===")
            params = op.get("parameters", [])
            for prm in params:
                print(f'  param: {prm.get("name")} ({prm.get("in")}) required={prm.get("required", False)}')
            rb = op.get("requestBody", {}).get("content", {})
            if rb:
                for ctype, schema in rb.items():
                    print(f"  Content-Type: {ctype}")
                    print(f'  Body: {json.dumps(schema.get("schema", {}))}')
            else:
                print("  (no request body)")
            for code in ("200", "201"):
                r = op.get("responses", {}).get(code)
                if r:
                    schema = r.get("content", {}).get("application/json", {}).get("schema", {})
                    print(f"  {code} Response: {json.dumps(schema)}")
