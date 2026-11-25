/* Fundamentals of Flying Vehicle Technology (2026) — Assignment 1 (EH216-S)
 * Bilingual engine, Evidence Filter, Physics Endurance Simulator, B2B Scenic ROI & Competitor Chart
 */

(function () {
  'use strict';

  function isEn() { return document.body.classList.contains('E'); }
  function t(cn, en) { return isEn() ? en : cn; }

  function prepareCanvas(canvas, cssHeight) {
    if (!canvas) return null;
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.parentElement ? canvas.parentElement.clientWidth : 520;
    if (width < 260) width = 260;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.height = cssHeight + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: width, h: cssHeight };
  }

  window.toggleLang = function () {
    var en = document.body.classList.toggle('E');
    var btn = document.getElementById('langBtn');
    if (btn) btn.textContent = en ? '中文' : 'EN';
    document.documentElement.lang = en ? 'en' : 'zh-CN';
    try { localStorage.setItem('fv_eh216_res_lang', en ? 'E' : 'C'); } catch (e) {}
    updatePhysicsSim();
    updateEconomicsCalc();
    drawCompetitorChart();
  };

  window.toggleNav = function () {
    var links = document.querySelector('.lab-nav-links');
    if (links) links.classList.toggle('open');
  };

  document.addEventListener('click', function (ev) {
    var link = ev.target.closest('.lab-nav-links a');
    if (link && !link.closest('.lab-lang-switch')) {
      var menu = document.querySelector('.lab-nav-links');
      if (menu) menu.classList.remove('open');
    }
  });

  function setupScrollSpy() {
    var bar = document.getElementById('readingProgress');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.fv-toc a'));
    var sections = tocLinks.map(function (a) {
      var id = a.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.getElementById(id.slice(1)) : null;
    }).filter(Boolean);

    function onScroll() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop;
      var height = doc.scrollHeight - doc.clientHeight;
      if (bar && height > 0) bar.style.width = Math.min(100, Math.max(0, (scrollTop / height) * 100)).toFixed(1) + '%';
      var currentId = '';
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= 120) currentId = sections[i].id;
      }
      tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href').slice(1) === currentId); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  window.filterEvidence = function (category, btnEl) {
    document.querySelectorAll('#evidenceFilterBar .fv-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btnEl) btnEl.classList.add('active');
    document.querySelectorAll('#evidenceMatrixTable tbody tr').forEach(function (row) {
      var tags = (row.getAttribute('data-tags') || '').split(',');
      row.classList.toggle('is-hidden', category !== 'all' && tags.indexOf(category) === -1);
    });
  };

  /* Physics Endurance Simulator (16 Coaxial Rotors on 8 Arms) */
  var SIM_DEFAULTS = { mtow: 620, usableKwh: 13.5, radius: 0.78, cruiseFactor: 0.76 };

  function calcHoverElecKw(mtowKg, rotorRadiusM, fm, etaElec) {
    var g = 9.80665, rho = 1.225;
    var W = mtowKg * g;
    /* 8 coaxial rotor pairs share disk area 8 * pi * R^2 (coaxial interference accounted via FM=0.66) */
    var area = 8 * Math.PI * rotorRadiusM * rotorRadiusM;
    var pIdealW = Math.pow(W, 1.5) / Math.sqrt(2 * rho * area);
    var pElecKw = pIdealW / (fm * etaElec * 1000);
    return { pElecKw: pElecKw, diskLoading: W / area };
  }

  function updatePhysicsSim() {
    var mtowEl = document.getElementById('simMtow');
    if (!mtowEl) return;
    var mtow = Number(mtowEl.value);
    var usableKwh = Number(document.getElementById('simKwh').value);
    var radius = Number(document.getElementById('simRadius').value);
    var cruiseFactor = Number(document.getElementById('simCruise').value);

    document.getElementById('valMtow').textContent = mtow + ' kg';
    document.getElementById('valKwh').textContent = usableKwh.toFixed(1) + ' kWh';
    document.getElementById('valRadius').textContent = radius.toFixed(2) + ' m';
    document.getElementById('valCruise').textContent = Math.round(cruiseFactor * 100) + '%';

    var FM = 0.66, ETA = 0.87;
    var res = calcHoverElecKw(mtow, radius, FM, ETA);
    var pCruiseKw = res.pElecKw * cruiseFactor;
    var hoverMin = (usableKwh / res.pElecKw) * 60;
    var cruiseMin = (usableKwh / pCruiseKw) * 60;
    var estRangeKm = (cruiseMin / 60) * 90;

    document.getElementById('outHoverPower').textContent = res.pElecKw.toFixed(1) + ' kW';
    document.getElementById('outDiskLoading').textContent = res.diskLoading.toFixed(0) + ' N/m²';
    document.getElementById('outEndurance').textContent = hoverMin.toFixed(1) + ' – ' + cruiseMin.toFixed(1) + ' min';
    document.getElementById('outRangeKm').textContent = estRangeKm.toFixed(1) + ' km (@90 km/h)';

    drawEnduranceCurve(mtow, usableKwh, radius, cruiseFactor, FM, ETA);
  }

  function drawEnduranceCurve(curMtow, usableKwh, radius, cruiseFactor, FM, ETA) {
    var canvas = document.getElementById('physicsCurveCanvas');
    var p = prepareCanvas(canvas, 230);
    if (!p) return;
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);

    var pad = { l: 48, r: 22, t: 28, b: 36 };
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

    for (var yVal = 0; yVal <= 60; yVal += 15) {
      var gy = pad.t + ph - (yVal / 60) * ph;
      ctx.strokeStyle = '#e4e8ec';
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.fillStyle = '#5c636b'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'right';
      ctx.fillText(yVal + 'm', pad.l - 6, gy + 4);
    }

    var y25 = pad.t + ph - (25 / 60) * ph;
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#9a5b13';
    ctx.beginPath(); ctx.moveTo(pad.l, y25); ctx.lineTo(w - pad.r, y25); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#9a5b13'; ctx.font = '10.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(t('25 min 液态锂电标称线', '25 min Li-ion spec line'), pad.l + 6, y25 - 5);

    var minM = 520, maxM = 700;
    [520, 580, 620, 660, 700].forEach(function (mVal) {
      var x = pad.l + ((mVal - minM) / (maxM - minM)) * pw;
      ctx.strokeStyle = '#e4e8ec';
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
      ctx.fillStyle = '#5c636b'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(mVal + 'kg', x, h - pad.b + 16);
    });

    function plotCurve(factor, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath();
      for (var m = minM; m <= maxM; m += 10) {
        var r = calcHoverElecKw(m, radius, FM, ETA);
        var mins = Math.min(60, (usableKwh / (r.pElecKw * factor)) * 60);
        var x = pad.l + ((m - minM) / (maxM - minM)) * pw;
        var y = pad.t + ph - (mins / 60) * ph;
        if (m === minM) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    plotCurve(1.0, '#6e8784');
    plotCurve(cruiseFactor, '#0f3b38');

    var curX = pad.l + ((curMtow - minM) / (maxM - minM)) * pw;
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#195e58';
    ctx.beginPath(); ctx.moveTo(curX, pad.t); ctx.lineTo(curX, h - pad.b); ctx.stroke(); ctx.restore();

    ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    var cLbl = '● ' + t('90km/h 巡航航时', '90km/h Cruise');
    var hLbl = '● ' + t('纯悬停下限', 'Pure Hover');
    var cW = ctx.measureText(cLbl).width;
    ctx.fillStyle = '#0f3b38'; ctx.fillText(cLbl, w - pad.r, 16);
    ctx.fillStyle = '#6e8784'; ctx.fillText(hLbl, w - pad.r - cW - 18, 16);
  }

  window.resetPhysicsSim = function () {
    document.getElementById('simMtow').value = SIM_DEFAULTS.mtow;
    document.getElementById('simKwh').value = SIM_DEFAULTS.usableKwh;
    document.getElementById('simRadius').value = SIM_DEFAULTS.radius;
    document.getElementById('simCruise').value = SIM_DEFAULTS.cruiseFactor;
    updatePhysicsSim();
  };

  /* B2B Scenic Operator ROI Calculator */
  function updateEconomicsCalc() {
    var priceEl = document.getElementById('ecoPrice');
    if (!priceEl) return;
    var priceWan = Number(priceEl.value);
    var flightsDay = Number(document.getElementById('ecoFlights').value);
    var ticketRmb = Number(document.getElementById('ecoTicket').value);

    document.getElementById('valEcoPrice').textContent = priceWan + (isEn() ? '0k RMB' : ' 万元');
    document.getElementById('valEcoFlights').textContent = flightsDay + (isEn() ? ' trips/day' : ' 架次/日');
    document.getElementById('valEcoTicket').textContent = ticketRmb + (isEn() ? ' RMB/seat' : ' 元/人');

    /* 260 operating days/yr (weather/maintenance), 2 seats sold avg ~1.75 pax/flight */
    var annualRev = flightsDay * 1.75 * ticketRmb * 260;
    /* Annual ops cost: pilot/GCS operator share + vertiport fee + battery/rotor reserve + insurance (~650k RMB/yr) */
    var annualOpex = 650000 + flightsDay * 260 * 140;
    var annualEbitda = annualRev - annualOpex;
    var capex = priceWan * 10000;

    document.getElementById('outEcoRev').textContent = (annualRev / 10000).toFixed(1) + (isEn() ? '0k RMB/yr' : ' 万元/年');
    document.getElementById('outEcoNet').textContent = (annualEbitda / 10000).toFixed(1) + (isEn() ? '0k RMB/yr' : ' 万元/年');

    var payEl = document.getElementById('outEcoPayback');
    if (annualEbitda <= 0) {
      payEl.textContent = t('无法回本（年现金流为负）', 'Unprofitable (Negative Cash Flow)');
    } else {
      payEl.textContent = (capex / annualEbitda).toFixed(1) + (isEn() ? ' years' : ' 年（静态回本周期）');
    }
  }

  /* Competitor Bubble Chart */
  var COMPETITORS = [
    { id: 'eh216', cn: '亿航 EH216-S', en: 'EHang EH216-S', rangeKm: 30, certScore: 98, roadScore: 10, color: '#0f3b38' },
    { id: 'lac', cn: '小鹏汇天 陆地航母', en: 'ARIDGE Land Carrier', rangeKm: 25, certScore: 68, roadScore: 95, color: '#173b4d' },
    { id: 'govy', cn: '广汽高域 GOVY AirCab', en: 'GAC GOVY AirCab', rangeKm: 30, certScore: 55, roadScore: 15, color: '#416d7e' },
    { id: 'joby', cn: 'Joby S4 (倾转旋翼)', en: 'Joby S4 (Tilt-rotor)', rangeKm: 160, certScore: 84, roadScore: 5, color: '#283e6e' },
    { id: 'aircar', cn: 'Klein Vision AirCar', en: 'Klein Vision AirCar', rangeKm: 1000, certScore: 48, roadScore: 72, color: '#6b7280' },
    { id: 'alef', cn: 'Alef Model A', en: 'Alef Model A', rangeKm: 177, certScore: 22, roadScore: 65, color: '#8e2424' }
  ];

  function drawCompetitorChart() {
    var canvas = document.getElementById('competitorCanvas');
    var p = prepareCanvas(canvas, 300);
    if (!p) return;
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);

    var pad = { l: 60, r: 30, t: 36, b: 48 };
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    ctx.fillStyle = '#f8fbfa'; ctx.fillRect(pad.l, pad.t, pw, ph);

    ctx.strokeStyle = '#e1e6ea'; ctx.lineWidth = 1;
    [25, 50, 75, 100].forEach(function (v) {
      var gx = pad.l + (v / 100) * pw, gy = pad.t + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(gx, pad.t); ctx.lineTo(gx, h - pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.fillStyle = '#5c636b'; ctx.font = '10.5px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.fillText(v + '%', gx, h - pad.b + 16);
      ctx.textAlign = 'right'; ctx.fillText(v + '%', pad.l - 8, gy + 4);
    });
    ctx.strokeStyle = '#9aa5ae'; ctx.strokeRect(pad.l, pad.t, pw, ph);

    ctx.fillStyle = '#0f3b38'; ctx.font = 'bold 11.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t('道路耦合便利度指数 →', 'Road Mobility & Coupling Index →'), pad.l + pw / 2, h - 10);
    ctx.save(); ctx.translate(16, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(t('适航取证与商业化落地确定性 →', 'Certification & Commercial Readiness →'), 0, 0); ctx.restore();

    COMPETITORS.forEach(function (c) {
      var x = pad.l + (c.roadScore / 100) * pw, y = pad.t + ph - (c.certScore / 100) * ph;
      var r = 8 + Math.log10(Math.max(10, c.rangeKm)) * 5.0;
      ctx.globalAlpha = 0.22; ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#111214'; ctx.font = 'bold 11px sans-serif';
      var label = (isEn() ? c.en : c.cn) + ' (' + c.rangeKm + 'km)';
      if (c.id === 'aircar') {
        ctx.textAlign = 'right'; ctx.fillText(label, w - pad.r - 4, y + r + 16);
      } else {
        var alignRight = x > pad.l + pw * 0.6;
        ctx.textAlign = alignRight ? 'right' : 'left';
        ctx.fillText(label, alignRight ? x - r - 7 : x + r + 7, y + 4);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (localStorage.getItem('fv_eh216_res_lang') === 'E') {
        document.body.classList.add('E'); document.documentElement.lang = 'en';
        var btn = document.getElementById('langBtn'); if (btn) btn.textContent = '中文';
      }
    } catch (e) {}
    setupScrollSpy();
    ['simMtow', 'simKwh', 'simRadius', 'simCruise'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', updatePhysicsSim);
    });
    ['ecoPrice', 'ecoFlights', 'ecoTicket'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', updateEconomicsCalc);
    });
    updatePhysicsSim(); updateEconomicsCalc(); drawCompetitorChart();
    window.addEventListener('resize', function () { updatePhysicsSim(); drawCompetitorChart(); });
  });
})();
