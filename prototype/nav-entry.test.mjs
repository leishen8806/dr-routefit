import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./app.mjs',import.meta.url),'utf8');

test('database fees entry is limited to operations and finance navigation',()=>{
 const nav=source.match(/const navItems=\(\)=>[\s\S]*?;\nconst viewTitle/)[0];
 assert.match(nav,/role==='ops'.*\['fees-api','wallet','费用设置（数据库）'\]/s);
 assert.match(nav,/role==='finance'.*\['fees-api','wallet','费用设置（数据库）'\]/s);
 assert.match(nav,/role==='customer'\?\[\['customer','box','我的配送申请'\]\]/);
 assert.match(nav,/role==='warehouse'\?\[\['warehouse','box','仓库交接'\],\['inventory','list','仓库与库存'\],\['prototype','settings','原型检查'\]\]/);
 assert.match(nav,/isDriver\(\)\?\[\['driver','truck','我的任务'\],\['prototype','settings','原型检查'\]\]/);
});

test('database fees entry preserves demo pricing and opens the independent page',()=>{
 assert.match(source,/运费与分成（演示）/);
 assert.match(source,/id==='fees-api'\?'\.\/fees\.html'/);
 assert.match(source,/ev\.target\.value==='fees-api'\)location\.assign\('\.\/fees\.html'\)/);
 assert.match(source,/id==='fees-api'\?canView\(db,previewSession,'pricing'\)/);
});
