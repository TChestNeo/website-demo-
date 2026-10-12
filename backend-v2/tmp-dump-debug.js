(function(){ try { return (() => {
    var r = {};
    var gs = function (el) { return el ? getComputedStyle(el) : null; };
    var sb = document.getElementById('slati-sidebar');
    var cs = gs(sb);
    r.theme = document.documentElement.getAttribute('data-theme');
    r.accent = document.documentElement.getAttribute('data-accent');
    r.vars = {};
    ['--card-bg','--card-border','--shadow-md','--sidebar-bg','--sidebar-border','--color-primary','--btn-ghost-hover'].forEach(function(v){ r.vars[v] = gs(document.documentElement).getPropertyValue(v).trim(); });
    r.sidebar = cs ? { bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0,50), border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, shadow: cs.boxShadow.slice(0,60) } : null;
    r.modules = Array.from(document.querySelectorAll('#slati-sidebar .sidebar-module')).map(function(m){
      var c = gs(m);
      return { cls: m.className, bg: c.backgroundColor, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, shadow: c.boxShadow.slice(0,50) };
    });
    r.active = (function(){
      var a = document.querySelector('#slati-sidebar .nav-item.active');
      if (!a) return null;
      var c = gs(a);
      return { label: a.textContent.trim().slice(0,12), bg: c.backgroundColor, color: c.color, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, anim: c.animationName, animFill: c.animationFillMode };
    })();
    r.navItems = Array.from(document.querySelectorAll('#slati-sidebar .nav-item')).map(function(n){
      var c = gs(n); return { label: n.textContent.trim().slice(0,12), bg: c.backgroundColor, color: c.color, cls: n.className };
    });
    // 白系元素扫描（rgb 通道 ≥200 且 alpha>0.3 的背景，≥4px）
    r.white = [];
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var el = all[i]; var rc = el.getBoundingClientRect();
      if (rc.width < 4 || rc.height < 4) continue;
      var c = gs(el); var s = c.backgroundColor + ' ' + c.backgroundImage;
      var m = s.match(/rgba?\(([^)]+)\)/g) || [];
      var whiteish = m.filter(function (x) {
        var n = x.match(/[\d.]+/g).map(Number);
        return n.length >= 3 && n[0] >= 200 && n[1] >= 200 && n[2] >= 200 && (n[3] === undefined || n[3] > 0.3);
      }).length > 0;
      if (whiteish) r.white.push((el.id ? '#' + el.id : '') + (typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '') + ' [' + el.tagName.toLowerCase() + ' ' + Math.round(rc.width) + 'x' + Math.round(rc.height) + '] bgc=' + c.backgroundColor + (c.backgroundImage !== 'none' ? ' bgi=' + c.backgroundImage.slice(0,60) : ''));
    }
    r.white = r.white.slice(0, 25);
    // ghost 按钮
    r.ghost = Array.from(document.querySelectorAll('.btn-ghost.btn-icon.btn-sm')).map(function(b){
      var c = gs(b);
      return { id: b.id, bg: c.backgroundColor, html: b.outerHTML.slice(0,120) };
    });
    // btn-primary / toggle 实际计算值
    var bt = document.createElement('button'); bt.className = 'btn-primary';
    document.body.appendChild(bt);
    var bcs = gs(bt);
    r.btn = { bg: bcs.backgroundImage.replace(/\s+/g, '').slice(0, 60), color: bcs.color, shadow: bcs.boxShadow.slice(0, 40) };
    bt.remove();
    var tog = document.querySelector('.toggle-switch.active');
    r.toggle = tog ? { bg: gs(tog).backgroundColor } : null;
    // 白→紫渐变元凶定位：所有背景含紫 129,39,207 的元素 + 所有 mn-ai-* 元素
    r.purple = [];
    var all2 = document.querySelectorAll('body *');
    for (var j = 0; j < all2.length; j++) {
      var e2 = all2[j]; var c2 = gs(e2);
      var bgi2 = c2.backgroundImage || '';
      var hit2 = bgi2.indexOf('129, 39, 207') !== -1 || bgi2.indexOf('rgb(129,39,207)') !== -1 || (typeof e2.className === 'string' && e2.className.indexOf('mn-ai') !== -1);
      if (hit2) {
        var rc2 = e2.getBoundingClientRect();
        r.purple.push({ tag: e2.tagName.toLowerCase(), cls: typeof e2.className === 'string' ? e2.className : '', id: e2.id, size: Math.round(rc2.width) + 'x' + Math.round(rc2.height), bgi: bgi2.slice(0,70), html: e2.outerHTML.slice(0,150) });
      }
    }
    // 弹窗打开后重扫 ghost（定位 28x28 神秘按钮）
    if (window.SlatiSettings && window.SlatiSettings.open) window.SlatiSettings.open();
    // 白光真身取证：lg-specular（镜面高光层，默认圆心=卡正中 rgba(255,255,255,0.16)）
    // 与 lg-backdrop、lg-orb-field——全站玻璃卡通用层，含设置弹窗 modal-card
    r.spec = Array.from(document.querySelectorAll('.lg-specular')).slice(0, 12).map(function (s) {
      var c = gs(s);
      var rc = s.getBoundingClientRect();
      var host = s.parentElement ? (s.parentElement.id ? '#' + s.parentElement.id : (typeof s.parentElement.className === 'string' ? s.parentElement.className.split(' ').slice(0, 2).join('.') : '')) : '';
      return { host: host, size: Math.round(rc.width) + 'x' + Math.round(rc.height), bg: c.backgroundImage.slice(0, 90), disp: c.display };
    });
    r.orb = Array.from(document.querySelectorAll('.lg-orb-field')).slice(0, 6).map(function (s) {
      var c = gs(s);
      return { bg: c.backgroundImage.slice(0, 90), disp: c.display };
    });
    return r;
  })() } catch (e) { return { __err: e.message + ' @ ' + (e.stack || '').split(String.fromCharCode(10))[1] }; } })()