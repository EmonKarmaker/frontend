import json
d = json.load(open("openapi-snapshot.json"))
paths = d["paths"]
# List every GET endpoint that returns user-scoped data
for p in sorted(paths):
    if "get" in paths[p]:
        op = paths[p]["get"]
        sec = "BEARER" if op.get("security") else "PUBLIC"
        params = [prm.get("name") for prm in op.get("parameters", [])]
        resp = op.get("responses", {}).get("200", {}).get("content", {}).get("application/json", {}).get("schema", {})
        ref = resp.get("$ref", "") or ("array of " + resp.get("items", {}).get("$ref", "") if resp.get("type") == "array" else json.dumps(resp))
        print(f"{sec}  GET {p}")
        print(f"    params: {params}")
        print(f"    response: {ref}")
        print()
