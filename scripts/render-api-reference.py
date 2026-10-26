"""Render catalog and field reference from the maintained OpenAPI JSON."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = json.loads((root / 'contracts/openapi.json').read_text(encoding='utf-8'))
out = root / 'contracts'
def safe(value):
    return str(value).replace('|', '／').replace('\n', ' ')
def kind(schema):
    if '$ref' in schema:
        name = schema['$ref'].split('/')[-1]
        return f'[{name}](fields.md#{name.lower()})'
    if 'const' in schema:
        return '`' + str(schema['const']) + '`'
    if 'enum' in schema:
        return ' / '.join('`' + str(v) + '`' for v in schema['enum'])
    if 'oneOf' in schema or 'anyOf' in schema:
        return ' 或 '.join(kind(v) for v in schema.get('oneOf', schema.get('anyOf')))
    if schema.get('type') == 'array':
        return 'array<' + kind(schema.get('items', {}) if isinstance(schema.get('items', {}), dict) else {}) + '>'
    return schema.get('type', '见完整Schema')

lines = ['# 接口目录 v0.1', '', '由 openapi.json 生成；字段修改以机器契约为源，再运行 scripts/render-api-reference.py。LOCAL_IMPLEMENTED_NOT_DEPLOYED 为已实现的本地开发切片；DESIGNED_NOT_DEPLOYED 为待实现设计。均不是已部署服务。鉴权、事务、状态条件见 [开发对照](implementation-guide.md)及[费用接口说明](pricing-api.md)。', '', '| 操作ID | 方法与路径 | 目的 | 权限（同时受对象范围限制） | 阶段 | 输入 → 输出 | 主版本对象 | 实现状态 |', '|---|---|---|---|---|---|---|---|']
for path, methods in spec['paths'].items():
    for method, op in methods.items():
        req = op.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema')
        success = next(v for k, v in op['responses'].items() if k.startswith('2'))
        res = success.get('content', {}).get('application/json', {}).get('schema')
        lines.append('| ' + ' | '.join(safe(v) for v in [op['operationId'],f'`{method.upper()} {path}`',op['summary'],', '.join(op['x-permissions']),op['x-stage'],(kind(req) if req else '无body')+' → '+(kind(res) if res else '无body'),op['x-version-resource'],op['x-implementation-status']])+' |')
(out/'endpoint-catalog.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
lines=['# 字段字典 v0.1','','由 openapi.json 生成。所有对象拒绝未声明字段；“可省略”不代表接受null。关联ID均须校验企业、货主、仓库和对象授权。示例见 examples/schema-cases.json；跨字段业务校验见开发对照。']
for name,schema in spec['components']['schemas'].items():
    lines += ['',f'## {name}','',schema.get('description',''), '']
    if 'properties' not in schema:
        lines += [kind(schema),''];continue
    lines += ['| 字段 | 类型 | 必填 | 约束和用途 |','|---|---|---|---|']
    for key,v in schema['properties'].items():
        constraints = [f'{k}={v[k]}' for k in ['format','minimum','maximum','minLength','maxLength','minItems','maxItems','uniqueItems','pattern','writeOnly'] if k in v]
        lines.append('| '+' | '.join(safe(x) for x in [key,kind(v),'是' if key in schema.get('required',[]) else '可省略',v.get('description','')+'；'+', '.join(constraints)])+' |')
(out/'fields.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Rendered endpoint-catalog.md and fields.md')
