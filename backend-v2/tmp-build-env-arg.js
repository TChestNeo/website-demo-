'use strict';
// tmp-build-env-arg.js — 读 tmp-run-describe.json 重建 --set-env-vars 参数值（逗号值加引号），
// 写 tmp-deploy-env-arg.txt；只打印条数，绝不打印任何值（tmp 绝不 commit）
const fs = require('node:fs');
const raw = fs.readFileSync(__dirname + '/tmp-run-describe.json', 'utf8').replace(/^﻿/, '');
const svc = JSON.parse(raw);
const env = svc.spec.template.spec.containers[0].env;
const parts = env.map((e) => {
  let v = e.value;
  if (v === undefined || v === null) v = '';
  v = String(v);
  if (v.includes(',')) v = '"' + v.replace(/"/g, '\\"') + '"';
  return e.name + '=' + v;
});
fs.writeFileSync(__dirname + '/tmp-deploy-env-arg.txt', parts.join(','), 'utf8');
console.log('env vars carried: ' + parts.length);
