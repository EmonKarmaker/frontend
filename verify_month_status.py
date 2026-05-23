import json
d = json.load(open("openapi-snapshot.json"))
s = d["components"]["schemas"]["MonthSummary"]
print("MonthSummary fields:")
for k, v in s["properties"].items():
    print(f"  {k}: {json.dumps(v)}")
print()
required = s.get("required", [])
print(f"status in required: {'status' in required}")
