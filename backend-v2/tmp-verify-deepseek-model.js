// tmp-verify-deepseek-model.js — 一次性：用用户提供的 key 实调验证模型名（deepseek-v4-flash vs 别名 deepseek-flash）
// 用户钦定「用 DeepSeek V4 Flash 不要用 Pro」。哪个名字活着钉哪个进 tags.js MODEL_DEFAULT。
'use strict';
const KEY = 'sk-8486d5cbdf9049e68f8d30f606ae1a95';

async function tryModel(model) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
        temperature: 0
      }),
      signal: AbortSignal.timeout(30000)
    });
    const body = await res.text();
    if (!res.ok) return { model, status: res.status, err: body.slice(0, 200) };
    const j = JSON.parse(body);
    const content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
    return { model, ok: true, content: String(content).slice(0, 40), ms: Date.now() - t0 };
  } catch (e) {
    return { model, status: 0, err: String(e && e.message || e) };
  }
}

(async () => {
  console.log('== deepseek-v4-flash ==');
  console.log(JSON.stringify(await tryModel('deepseek-v4-flash'), null, 1));
  console.log('== deepseek-flash ==');
  console.log(JSON.stringify(await tryModel('deepseek-flash'), null, 1));
})();
