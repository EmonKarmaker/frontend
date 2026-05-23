import json
d = json.load(open('openapi-snapshot.json'))
schemas = d['components']['schemas']
checks = [
    ('ShoppingEntryResponse', 'paid_by', False),
    ('ShoppingItemResponse', 'target_user', True),
    ('MealLogResponse', 'user', False),
    ('SettlementResponse', 'from_user', False),
    ('SettlementResponse', 'to_user', False),
    ('SettlementResponse', 'paid_marked_by', True),
    ('MonthCloseResponse', 'closed_by', False),
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
