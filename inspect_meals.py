import json
d = json.load(open("openapi-snapshot.json"))
paths = d["paths"]
for p in sorted(paths):
    if "/meals" in p:
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
            resp200 = op.get("responses", {}).get("200", op.get("responses", {}).get("201", {}))
            resp_schema = resp200.get("content", {}).get("application/json", {}).get("schema", {})
            print(f"  Response: {json.dumps(resp_schema)}")
