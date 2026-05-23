import json
d = json.load(open("openapi-snapshot.json"))
s = d["components"]["schemas"]
for name in ["SharedAssetResponse", "SharedAssetUpdate", "Body_create_asset_api_v1_assets_post", "AssetContributionResponse", "AssetRefundResponse"]:
    if name in s:
        print(f"=== {name} ===")
        print(json.dumps(s[name], indent=2))
        print()
