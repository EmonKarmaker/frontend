import json
d = json.load(open('openapi-snapshot.json'))
schemas = d['components']['schemas']
checks = [
    ('AssetContributionResponse', 'user', False),
    ('AssetRefundResponse', 'user', False),
    ('AssetRefundResponse', 'paid_by', True),
    ('AssetRefundResponse', 'replaced_by', True),
    ('SharedAssetResponse', 'bought_by', False),
    ('SecurityDepositResponseFull', 'user', False),
    ('SecurityDepositResponseFull', 'held_by', False),
    ('CommentResponse', 'user', False),
    ('RoomAssignmentResponse', 'user', False),
    ('ProcessLeavingResponse', 'user', False),
    ('ProcessLeavingAssetRefund', 'paid_by', True),
]
fail = 0
for schema_name, field, expect_nullable in checks:
    schema = schemas.get(schema_name, {})
    props = schema.get('properties', {})
    field_def = props.get(field)
    if field_def is None:
        print(f'FAIL {schema_name}.{field}: MISSING')
        fail += 1
        continue
    refs = json.dumps(field_def)
    has_null = 'null' in refs
    ok_ref = '#/components/schemas/UserMini' in refs
    ok_null = has_null == expect_nullable
    status = 'OK' if (ok_ref and ok_null) else 'FAIL'
    if status == 'FAIL':
        fail += 1
    print(f'{status} {schema_name}.{field}: nullable={has_null}, ref_ok={ok_ref}')
print()
print('Result:', 'ALL PASS' if fail == 0 else f'{fail} FAIL(S)')
