import json
d = json.load(open("openapi-snapshot.json"))
s = d["components"]["schemas"]
for name in sorted(s):
    if "Month" in name or "Settlement" in name:
        print(f"=== {name} ===")
        print(json.dumps(s[name], indent=2))
        print()
