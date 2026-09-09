// ── Clock ──────────────────────────────────────────────────────────────
function updateTime() {
  const now = new Date();
  document.getElementById('live-date').textContent = now.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('live-time').textContent = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
updateTime(); setInterval(updateTime, 1000);

// ── Tab switching ──────────────────────────────────────────────────────
let currentTab = 'exam';
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  const activeBtn = document.getElementById('tbtn-' + tab);
  activeBtn.classList.add('active');
  activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  currentTab = tab;
  updateProgress();
  updateTabArrows();

  // ── Lazy init for referred tab ──────────────────────────────────────
  // Wire selector must be built after the panel is visible (display:block)
  if (tab === 'referred') {
    const rws = document.getElementById('ref-wire-selector');
    if (rws && !rws.children.length) {
      buildWireSelector('ref-wire-selector');
      // Restore saved wire state if present
      const saved = localStorage.getItem('ortho_v4_referred');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          const ws = data['wires__ref-wire-selector'];
          if (ws && wireState['ref-wire-selector']) {
            ['upper','lower'].forEach(arch => {
              if (!ws[arch]) return;
              wireState['ref-wire-selector'][arch] = ws[arch];
              if (ws[arch].size) {
                const chip = [...rws.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="size"]`)]
                  .find(c => c.dataset.val === ws[arch].size);
                if (chip) {
                  rws.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="size"]`)
                    .forEach(c => c.classList.remove('sel-size'));
                  chip.classList.add('sel-size');
                }
              }
              if (ws[arch].mat) {
                const chip = [...rws.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="mat"]`)]
                  .find(c => c.dataset.val === ws[arch].mat);
                if (chip) {
                  rws.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="mat"]`)
                    .forEach(c => c.classList.remove('sel-mat'));
                  chip.classList.add('sel-mat');
                }
              }
            });
          }
        } catch(e) { /* ignore */ }
      }
    }
    // Build ext chart if Other was previously selected
    const extVal = document.querySelector('[name="ref-prev-ext"]:checked')?.value;
    if (extVal === 'Other') {
      const uw = document.getElementById('ref-ext-chart-upper');
      const lw = document.getElementById('ref-ext-chart-lower');
      if (uw && !uw.children.length) buildRefExtRow(uw, upperTeeth);
      if (lw && !lw.children.length) buildRefExtRow(lw, lowerTeeth);
    }
  }
}

// ── Tab arrow scroll buttons ───────────────────────────────────────────
function scrollTabs(dir) {
  const wrap = document.getElementById('tab-nav-wrap');
  if (!wrap) return;
  wrap.scrollBy({ left: dir * 160, behavior: 'smooth' });
  setTimeout(updateTabArrows, 320);
}

function updateTabArrows() {
  const outer = document.getElementById('tab-nav-outer');
  const wrap  = document.getElementById('tab-nav-wrap');
  const btnL  = document.getElementById('tab-arrow-left');
  const btnR  = document.getElementById('tab-arrow-right');
  if (!outer || !wrap || !btnL || !btnR) return;

  const isScrollable = wrap.scrollWidth > wrap.clientWidth + 4;
  outer.classList.toggle('scrollable', isScrollable);

  btnL.classList.toggle('hidden', wrap.scrollLeft < 8);
  btnR.classList.toggle('hidden', wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 8);
}

// ── Tab nav: observe size changes ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const wrap  = document.getElementById('tab-nav-wrap');
  const outer = document.getElementById('tab-nav-outer');
  if (!wrap) return;
  wrap.addEventListener('scroll', updateTabArrows, { passive: true });
  updateTabArrows();
  if (window.ResizeObserver) {
    new ResizeObserver(updateTabArrows).observe(wrap);
  }

  // ── Fix gap: set tab-nav-outer top = actual header height ──
  function syncStickyTops() {
    const header = document.querySelector('.page-header');
    if (!header || !outer) return;
    const h = header.getBoundingClientRect().height;
    outer.style.top = h + 'px';
    // progress bar sits below tab nav (~42px tall)
    const pbWrap = document.querySelector('.progress-bar-wrap');
    if (pbWrap) pbWrap.style.top = (h + 42) + 'px';
  }
  syncStickyTops();
  window.addEventListener('resize', syncStickyTops);
});

// ── Tab nav: remove mask-related code (gradient removed) ───────────────

// ── Section toggle ─────────────────────────────────────────────────────
function toggleSection(id) { document.getElementById(id).classList.toggle('collapsed'); }

// ── Progress bar ───────────────────────────────────────────────────────
function updateProgress() {
  const panel = document.querySelector('.tab-panel.active');
  const inputs = panel.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea');
  let filled = 0;
  inputs.forEach(i => { if (i.value && i.value.trim()) filled++; });
  document.getElementById('progressBar').style.width = inputs.length ? Math.min(100, Math.round((filled/inputs.length)*100)) + '%' : '0%';
}
document.addEventListener('input', updateProgress);
document.addEventListener('change', updateProgress);

// ── Wire sizes & materials ─────────────────────────────────────────────
const WIRE_SIZES = ['0.012','0.014','0.016','0.018','0.020','0.016×0.016','0.016×0.022','0.017×0.025','0.018×0.025','0.019×0.025','0.021×0.025'];
const WIRE_MATS  = ['NiTi','SS','RCS NiTi','TMA'];

// Wire state: { containerId: { upper: {size, mat}, lower: {size, mat} } }
const wireState = {};

function buildWireSelector(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wireState[containerId] = { upper: { size:'', mat:'' }, lower: { size:'', mat:'' } };

  ['upper','lower'].forEach(arch => {
    const row = document.createElement('div');
    row.className = 'wire-arch-row';

    const lbl = document.createElement('div');
    lbl.className = 'wire-arch-label';
    lbl.textContent = arch.charAt(0).toUpperCase() + arch.slice(1);

    const sizeCol = document.createElement('div');
    const sizeHdr = document.createElement('div');
    sizeHdr.className = 'wire-col-label';
    sizeHdr.textContent = 'Size';
    const sizeChips = document.createElement('div');
    sizeChips.className = 'wire-chips';
    WIRE_SIZES.forEach(s => {
      const chip = document.createElement('div');
      chip.className = 'wire-chip';
      chip.textContent = s;
      chip.dataset.arch = arch;
      chip.dataset.type = 'size';
      chip.dataset.val = s;
      chip.onclick = () => selectWireChip(containerId, arch, 'size', s, chip);
      sizeChips.appendChild(chip);
    });
    sizeCol.appendChild(sizeHdr);
    sizeCol.appendChild(sizeChips);

    const matCol = document.createElement('div');
    const matHdr = document.createElement('div');
    matHdr.className = 'wire-col-label';
    matHdr.textContent = 'Material';
    const matChips = document.createElement('div');
    matChips.className = 'wire-chips';
    WIRE_MATS.forEach(m => {
      const chip = document.createElement('div');
      chip.className = 'wire-chip';
      chip.textContent = m;
      chip.dataset.arch = arch;
      chip.dataset.type = 'mat';
      chip.dataset.val = m;
      chip.onclick = () => selectWireChip(containerId, arch, 'mat', m, chip);
      matChips.appendChild(chip);
    });
    matCol.appendChild(matHdr);
    matCol.appendChild(matChips);

    row.appendChild(lbl);
    row.appendChild(sizeCol);
    row.appendChild(matCol);
    wrap.appendChild(row);
  });
}

function selectWireChip(containerId, arch, type, val, chip) {
  // Deselect siblings of same type+arch
  const wrap = document.getElementById(containerId);
  wrap.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="${type}"]`).forEach(c => c.classList.remove('sel-size','sel-mat'));
  chip.classList.add(type === 'size' ? 'sel-size' : 'sel-mat');
  wireState[containerId][arch][type] = val;
}

function getWireText(containerId, arch) {
  const s = wireState[containerId]?.[arch];
  if (!s) return '';
  const parts = [s.size, s.mat].filter(Boolean);
  return parts.join(' ');
}

// Build wire selectors for all forms
// Note: ref-wire-selector is built lazily on first tab activation (see switchTab)
['bond-wire-selector','fuf-wire-selector','em-wire-selector'].forEach(buildWireSelector);


// ══════════════════════════════════════════════════════════════
// GMD — Growth Modification Device helper functions
// ══════════════════════════════════════════════════════════════

// updateGmdCategory: إظهار/إخفاء قوائم الأجهزة بحسب الفئة المختارة
// ── Occlusal Cant visibility ───────────────────────────────────────────
function updateOccCantVisibility() {
  const val = document.querySelector('[name="occCant"]:checked')?.value || '';
  const details = document.getElementById('occ-cant-details');
  if (!details) return;
  details.style.display = (val && val !== 'None') ? '' : 'none';
}

function updateGmdCategory() {
  const val = document.querySelector('[name="gmd-category"]:checked')?.value || '';
  const isRemovable = val === 'functional-removable';
  const isFixed     = val === 'functional-fixed';
  const isHG        = val === 'headgear';

  const remWrap = document.getElementById('gmd-removable-wrap');
  const fixWrap = document.getElementById('gmd-fixed-wrap');
  const hgWrap  = document.getElementById('gmd-headgear-wrap');

  if (remWrap) remWrap.style.display = isRemovable ? '' : 'none';
  if (fixWrap) fixWrap.style.display = isFixed     ? '' : 'none';
  if (hgWrap)  hgWrap.style.display  = isHG        ? '' : 'none';

  // إخفاء كل detail sections ثم إظهار المناسب بحسب الجهاز المختار
  updateGmdDetailSection();
}

// updateGmdDetailSection: إظهار قسم التفاصيل بحسب الجهاز المختار
function updateGmdDetailSection() {
  const category = document.querySelector('[name="gmd-category"]:checked')?.value || '';
  const remType  = document.querySelector('[name="gmd-removable-type"]:checked')?.value || '';
  const fixType  = document.querySelector('[name="gmd-fixed-type"]:checked')?.value || '';

  const tbWrap      = document.getElementById('gmd-detail-twinblock');
  const herbstWrap  = document.getElementById('gmd-detail-herbst');
  const genericWrap = document.getElementById('gmd-detail-generic-removable');

  if (tbWrap)      tbWrap.style.display      = 'none';
  if (herbstWrap)  herbstWrap.style.display  = 'none';
  if (genericWrap) genericWrap.style.display = 'none';

  if (category === 'functional-removable') {
    if (remType === 'Twin Block' || remType === 'Modified Twin Block') {
      if (tbWrap) tbWrap.style.display = '';
    } else if (remType) {
      if (genericWrap) genericWrap.style.display = '';
    }
  } else if (category === 'functional-fixed') {
    if (fixType === 'Herbst' || fixType === 'Forsus') {
      if (herbstWrap) herbstWrap.style.display = '';
    } else if (fixType) {
      if (genericWrap) genericWrap.style.display = '';
    }
  }
}

// highlightCS: تلوين الـ CS stage المختار
function highlightCS() {
  const val = document.querySelector('[name="gmd-cs-stage"]:checked')?.value || '';
  for (let i = 1; i <= 6; i++) {
    const lbl = document.getElementById('cs-lbl-' + i);
    if (!lbl) continue;
    if (val === 'CS' + i) {
      lbl.style.borderColor = 'var(--teal)';
      lbl.style.background  = 'var(--teal-light)';
    } else {
      lbl.style.borderColor = '';
      lbl.style.background  = '';
    }
  }
}

// calcGmdChange: حساب التغيير في OJ/OB/LFH مقارنة بالقياسات الأساسية
function calcGmdChange() {
  const baseOJ  = parseFloat(document.getElementById('gmd-base-oj')?.value)  || null;
  const baseOB  = parseFloat(document.getElementById('gmd-base-ob')?.value)  || null;
  const baseLFH = parseFloat(document.getElementById('gmd-base-lfh')?.value) || null;

  const nowOJ  = parseFloat(document.getElementById('fug-oj-now')?.value)  || null;
  const nowOB  = parseFloat(document.getElementById('fug-ob-now')?.value)  || null;
  const nowLFH = parseFloat(document.getElementById('fug-lfh-now')?.value) || null;

  const ojEl  = document.getElementById('fug-oj-change');
  const obEl  = document.getElementById('fug-ob-change');
  const lfhEl = document.getElementById('fug-lfh-change');

  if (ojEl) {
    if (baseOJ !== null && nowOJ !== null) {
      const diff = parseFloat((baseOJ - nowOJ).toFixed(1));
      ojEl.textContent = diff > 0 ? `▼ ${diff} mm reduction` : diff < 0 ? `▲ ${Math.abs(diff)} mm increase` : '— No change';
      ojEl.style.color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--grey-400)';
    } else { ojEl.textContent = ''; }
  }

  if (obEl) {
    if (baseOB !== null && nowOB !== null) {
      const diff = parseFloat((baseOB - nowOB).toFixed(1));
      obEl.textContent = diff > 0 ? `▼ ${diff} mm reduction` : diff < 0 ? `▲ ${Math.abs(diff)} mm increase` : '— No change';
      obEl.style.color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--grey-400)';
    } else { obEl.textContent = ''; }
  }

  if (lfhEl) {
    if (baseLFH !== null && nowLFH !== null) {
      const diff = parseFloat((nowLFH - baseLFH).toFixed(1));
      lfhEl.textContent = diff > 0 ? `▲ ${diff} mm increase` : diff < 0 ? `▼ ${Math.abs(diff)} mm decrease` : '— No change';
      lfhEl.style.color = 'var(--teal)';
    } else { lfhEl.textContent = ''; }
  }
}

// updateGmdDecision: إظهار/إخفاء قسم Phase II عند اختيار قرار الانتقال
function updateGmdDecision() {
  const val = document.querySelector('[name="fug-decision"]:checked')?.value || '';
  const transitionDetail = document.getElementById('fug-transition-detail');
  if (!transitionDetail) return;
  const isTransition = val.includes('transition') || val.includes('retention');
  transitionDetail.style.display = isTransition ? '' : 'none';
}

// gmdPlanSummaryLines: توليد سطور الملخص لخطة GMD
function gmdPlanSummaryLines() {
  const lines = [];
  const category  = document.querySelector('[name="gmd-category"]:checked')?.value  || '';
  const remType   = document.querySelector('[name="gmd-removable-type"]:checked')?.value || '';
  const fixType   = document.querySelector('[name="gmd-fixed-type"]:checked')?.value    || '';
  const hgType    = document.querySelector('[name="gmd-hg-type"]:checked')?.value       || '';
  const csStage   = document.querySelector('[name="gmd-cs-stage"]:checked')?.value      || '';
  const growthSt  = document.querySelector('[name="gmd-growth-status"]:checked')?.value || '';
  const skelClass = document.querySelector('[name="gmd-skeletal-class"]:checked')?.value || '';
  const vertPat   = document.querySelector('[name="gmd-vert-pattern"]:checked')?.value  || '';
  const phase     = document.querySelector('[name="gmd-phase"]:checked')?.value          || '';

  const appliance = remType || fixType || hgType;
  if (category)  lines.push(`  · Category: ${category}`);
  if (appliance) lines.push(`  · Appliance: ${appliance}`);
  if (csStage)   lines.push(`  · Cervical Vertebrae Stage: ${csStage}`);
  if (growthSt)  lines.push(`  · Growth Status: ${growthSt}`);
  if (skelClass) lines.push(`  · Skeletal Class: ${skelClass}`);
  if (vertPat)   lines.push(`  · Vertical Pattern: ${vertPat}`);

  const baseOJ  = document.getElementById('gmd-base-oj')?.value;
  const baseOB  = document.getElementById('gmd-base-ob')?.value;
  const baseLFH = document.getElementById('gmd-base-lfh')?.value;
  if (baseOJ)  lines.push(`  · Baseline OJ: ${baseOJ} mm`);
  if (baseOB)  lines.push(`  · Baseline OB: ${baseOB} mm`);
  if (baseLFH) lines.push(`  · Baseline LFH: ${baseLFH} mm`);

  if (phase) lines.push(`  · Treatment Phase: ${phase}`);
  const dur = document.getElementById('gmd-duration')?.value;
  if (dur)   lines.push(`  · Est. Duration: ${dur}`);
  const goals = document.getElementById('gmd-goals')?.value;
  if (goals) lines.push(`  · Goals: ${goals}`);

  return lines;
}

// ── Appliance card toggling ────────────────────────────────────────────
function updateApplianceCard() {
  const val = document.querySelector('[name="plan-appliance-type"]:checked')?.value;
  const pff = document.getElementById('plan-fixed-fields');
  const paf = document.getElementById('plan-aligner-fields');
  const pgf = document.getElementById('plan-gmd-fields');
  if (pff) pff.style.display = val === 'fixed'   ? '' : 'none';
  if (paf) paf.style.display = val === 'aligner' ? '' : 'none';
  if (pgf) pgf.style.display = val === 'gmd'     ? '' : 'none';
  document.getElementById('card-fixed')?.classList.toggle('selected',   val === 'fixed');
  document.getElementById('card-aligner')?.classList.toggle('selected', val === 'aligner');
  document.getElementById('card-gmd')?.classList.toggle('selected',     val === 'gmd');
}

function updateBondCard() {
  const val = document.querySelector('[name="bond-type"]:checked')?.value;
  document.getElementById('bond-fixed-section').style.display = val === 'fixed' ? '' : 'none';
  document.getElementById('bond-aligner-section').style.display = val === 'aligner' ? '' : 'none';
  document.getElementById('bcard-fixed').classList.toggle('selected', val === 'fixed');
  document.getElementById('bcard-aligner').classList.toggle('selected', val === 'aligner');
}

// ── Bond summary auto-text ─────────────────────────────────────────────
function updateBondSummary() {
  const arch  = document.querySelector('[name="bond-arch"]:checked')?.value || 'Upper 6-6 & Lower 6-6';
  const rx    = document.querySelector('[name="bond-rx"]:checked')?.value   || 'MBT';
  const brand = document.querySelector('[name="bond-brand"]:checked')?.value || 'OrthoTech';
  document.getElementById('bond-fixed-summary').textContent =
    `${arch} fixed orthodontic appliance with 0.022 × 0.028" slot and ${rx} prescription (${brand}) was bonded.`;
}

// ── Aligner progress ───────────────────────────────────────────────────
function updateAlignerProgress() {
  const cur = parseInt(document.getElementById('fua-current-aligner').value) || 0;
  const tot = parseInt(document.getElementById('fua-total-aligners').value)  || 0;
  if (tot > 0) {
    const pct = Math.min(100, Math.round((cur / tot) * 100));
    document.getElementById('aligner-fill').style.width = pct + '%';
    document.getElementById('aligner-pct').textContent = `Aligner ${cur} of ${tot} — ${pct}% complete`;
  }
}

// ── Emergency tooth charts ─────────────────────────────────────────────
const emChartPills = ['De-bonded bracket','De-bonded molar tube','De-bonded retainer','Loose band'];
const emChartSets  = {};
emChartPills.forEach(p => emChartSets[p] = new Set());

// ── Rebond tooth charts ────────────────────────────────────────────────
const rebondActions = [
  'fuf-rebond-bracket','fuf-rebond-rebond','fuf-rebond-replace-bracket',
  'fuf-rebond-tube','fuf-rebond-retube','fuf-rebond-replace-tube',
  'fuf-rebond-button','fuf-rebond-rebutton','fuf-rebond-replace-button'
];
const rebondLabels = {
  'fuf-rebond-bracket':'Bond bracket','fuf-rebond-rebond':'Re-bond bracket',
  'fuf-rebond-replace-bracket':'Replace bracket','fuf-rebond-tube':'Bond molar tube',
  'fuf-rebond-retube':'Re-bond molar tube','fuf-rebond-replace-tube':'Replace molar tube',
  'fuf-rebond-button':'Bond button','fuf-rebond-rebutton':'Re-bond button',
  'fuf-rebond-replace-button':'Replace button'
};
const rebondChartSets = {};
rebondActions.forEach(a => rebondChartSets[a] = new Set());

// Extraction chart (plan tab)
const extChartSet = new Set();

function toggleRebondChart(id) {
  const wrap = document.getElementById(`${id}-chart-wrap`);
  if (!wrap) return;
  const checked = document.getElementById(id)?.checked;
  wrap.style.display = checked ? '' : 'none';
  if (checked) {
    const subset = molarActions.has(id) ? molarTeeth : null;
    buildMiniChart(`${id}-chart-row`, rebondChartSets[id], () => {
      const lbl = document.getElementById(`${id}-chart-selected`);
      if (lbl) lbl.textContent = selectedLabel(rebondChartSets[id]);
    }, subset);
  }
}

function toggleEmChart(pill) {
  const val = pill.dataset.val;
  const wasActive = pill.classList.contains('active');
  pill.classList.toggle('active');
  if (wasActive) activeEmPills.delete(val);
  else activeEmPills.add(val);
  // Show/hide chart for this pill if applicable
  const chartKey = val.replace(/[^a-z0-9]/gi,'-').toLowerCase();
  const wrap = document.getElementById(`em-chart-wrap-${chartKey}`);
  if (wrap) {
    wrap.style.display = pill.classList.contains('active') ? '' : 'none';
    if (pill.classList.contains('active')) {
      const isMolarPill = (val === 'De-bonded molar tube');
      const subset = isMolarPill ? molarTeeth : null;
      buildMiniChart(`em-chart-row-${chartKey}`, emChartSets[val], () => {
        const lbl = document.getElementById(`em-chart-sel-${chartKey}`);
        if (lbl) lbl.textContent = selectedLabel(emChartSets[val]);
      }, subset);
    }
  }
}
const activeEmPills = new Set();
function toggleEmPill(el) { toggleEmChart(el); }
function getEmTypes() { return [...activeEmPills].join(', '); }

// ── Notation system (FDI / Palmer / Universal) ─────────────────────────
let NOTATION = localStorage.getItem('ortho_notation') || 'FDI';

const PALMER_MAP = {
  18:'UR8',17:'UR7',16:'UR6',15:'UR5',14:'UR4',13:'UR3',12:'UR2',11:'UR1',
  21:'UL1',22:'UL2',23:'UL3',24:'UL4',25:'UL5',26:'UL6',27:'UL7',28:'UL8',
  48:'LR8',47:'LR7',46:'LR6',45:'LR5',44:'LR4',43:'LR3',42:'LR2',41:'LR1',
  31:'LL1',32:'LL2',33:'LL3',34:'LL4',35:'LL5',36:'LL6',37:'LL7',38:'LL8'
};

// Universal (ADA) numbering — upper right to upper left, then lower left to lower right
const UNIVERSAL_MAP = {
  18:1,  17:2,  16:3,  15:4,  14:5,  13:6,  12:7,  11:8,
  21:9,  22:10, 23:11, 24:12, 25:13, 26:14, 27:15, 28:16,
  38:17, 37:18, 36:19, 35:20, 34:21, 33:22, 32:23, 31:24,
  41:25, 42:26, 43:27, 44:28, 45:29, 46:30, 47:31, 48:32
};

function toothLabel(num) {
  if (NOTATION === 'Palmer')    return PALMER_MAP[num]    || num;
  if (NOTATION === 'Universal') return UNIVERSAL_MAP[num] || num;
  return num; // FDI
}

function applyNotationToCharts() {
  // Main dental chart
  [...upperTeeth,...lowerTeeth].forEach(num => {
    const btn = document.getElementById('tooth-'+num);
    if (btn) btn.textContent = toothLabel(num);
  });
  // Mini charts (ligature, rebond, emergency)
  document.querySelectorAll('.mini-tooth[data-fdi]').forEach(el => {
    el.textContent = toothLabel(parseInt(el.dataset.fdi));
  });
}

function setNotation(system) {
  NOTATION = system;
  localStorage.setItem('ortho_notation', system);
  applyNotationToCharts();
}

// ── Dental chart ───────────────────────────────────────────────────────
const upperTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const lowerTeeth = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const toothState = {};
const toothStates = ['normal','carious','rcted','missing','restored'];

function buildRow(teeth, rowId) {
  const row = document.getElementById(rowId);
  teeth.forEach((num, i) => {
    if (i === 8) { const m = document.createElement('div'); m.className='midline-indicator'; row.appendChild(m); }
    const wrap = document.createElement('div');
    const btn  = document.createElement('button');
    btn.className='tooth-btn'; btn.type='button'; btn.id='tooth-'+num;
    btn.textContent=toothLabel(num); btn.dataset.fdi=num; toothState[num]=0;
    btn.onclick = () => {
      toothState[num] = (toothState[num]+1) % toothStates.length;
      const s = toothStates[toothState[num]];
      btn.className = 'tooth-btn' + (s!=='normal' ? ' '+s : '');
      btn.title = s!=='normal' ? toothLabel(num)+': '+s : '';
    };
    wrap.appendChild(btn); row.appendChild(wrap);
  });
}
buildRow(upperTeeth,'upper-row');
buildRow(lowerTeeth,'lower-row');

// ── Helpers ────────────────────────────────────────────────────────────
const get   = id => document.getElementById(id)?.value.trim() || '';
const radio = (name, scope) => { const el = (scope||document).querySelector(`[name="${name}"]:checked`); return el ? el.value : ''; };
const isChk = id => !!document.getElementById(id)?.checked;
const chkList = name => [...document.querySelectorAll(`[name="${name}"]:checked`)].map(e=>e.value);

function chartSummary() {
  const g = { carious:[], rcted:[], missing:[], restored:[] };
  // FIX: convert FDI numbers to the active notation via toothLabel()
  [...upperTeeth,...lowerTeeth].forEach(n => { const s=toothStates[toothState[n]]; if(s!=='normal') g[s].push(toothLabel(n)); });
  const out = [];
  if(g.carious.length)  out.push(`  · Carious teeth: ${g.carious.join(', ')}`);
  if(g.rcted.length)    out.push(`  · RCTed teeth: ${g.rcted.join(', ')}`);
  if(g.missing.length)  out.push(`  · Missing teeth: ${g.missing.join(', ')}`);
  if(g.restored.length) out.push(`  · Restored / Crowned: ${g.restored.join(', ')}`);
  if(get('chartNotes')) out.push(`  · Notes: ${get('chartNotes')}`);
  return out;
}

function elasticText(typeName, sizeName, forceName) {
  const type  = radio(typeName);
  const size  = radio(sizeName);
  const force = radio(forceName);
  if (!type || type === 'None') return '';
  return [type, size, force].filter(Boolean).join(' — ');
}

// ── Summary builders ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// UNIFIED DATA LAYER
// collectFormData(tab) → [ { title, rows: [{label, value, aseptic, bold}] } ]
// renderAsText(sections)   → plain text for clipboard
// renderAsPrintSections(sections) → same array used by buildPrintHTML
// ═══════════════════════════════════════════════════════════════════

function collectFormData(tab) {
  const sections = [];
  let sec = null;

  // Helpers
  const S  = title => { sec = { title, rows:[] }; sections.push(sec); };
  const R  = (label, value) => {
    if (!value && value !== 0) return;
    const v = String(value).trim();
    if (!v) return;
    sec.rows.push({ label: String(label), value: v });
  };
  const RA = value => { if (!value) return; sec.rows.push({ label:'', value: String(value), aseptic:true }); };
  const RB = value => { if (!String(value||'').trim()) return; sec.rows.push({ label:'', value: String(value), bold:true }); };

  switch(tab) {

    // ══════════════════════════════════════
    case 'exam': {
      S('Patient Information');
      R('Name', get('patientName'));
      R('Age',  get('age') ? get('age')+' years' : '');
      R('Sex',  radio('sex'));

      const conds=[];
      if(isChk('mhx-nil'))     conds.push('NAD');
      if(isChk('mhx-dm'))      conds.push('Diabetes Mellitus');
      if(isChk('mhx-htn'))     conds.push('Hypertension');
      if(isChk('mhx-thyroid')) conds.push('Thyroid Disorder');
      if(isChk('mhx-asthma'))  conds.push('Asthma');
      if(isChk('mhx-cardiac')) conds.push('Cardiac Condition');
      if(isChk('mhx-cleft'))   conds.push('Cleft Lip/Palate');
      if(isChk('mhx-growth'))  conds.push('Growth Disorder');
      if(isChk('mhx-other'))   conds.push('Other (see notes)');
      S('Medical History');
      R('Medical Hx',   conds.length ? conds.join(', ') : 'NAD');
      R('Medications',  get('medications'));
      R('Allergies',    get('allergies'));
      R('Previous orthodontic treatment', get('prevOrtho'));
      R('Notes',        get('mhxNotes'));

      const ccItems = chkList('cc');
      S('Chief Complaint');
      R('Chief complaint', ccItems.length ? ccItems.join(', ') : '');
      R('Description',  get('ccFree'));
      R('Motivation',   radio('motivation'));

      S('Facial Analysis');
      const prof=radio('profile'), vert=radio('vertPattern');
      if(prof||vert) R('Profile', [prof, vert?'with '+vert+' pattern':''].filter(Boolean).join(' '));
      R('Symmetry', radio('facialSym'));

      S('Smile & Lips');
      R('Smile arc',          radio('smileArc'));
      R('Gingival display',   radio('gingiDisplay'));
      R('Buccal corridors',   radio('buccalCorridor'));
      R('Lip competence',     radio('lipComp'));
      R('Lip position — Upper', radio('lipUpper'));
      R('Lip position — Lower', radio('lipLower'));
      R('Nasolabial angle',   radio('nasoAngle'));

      // Occlusal Cant — only include detail fields if cant is present
      const occCantVal = radio('occCant');
      if (occCantVal) {
        S('Occlusal Plane / Canting');
        R('Occlusal cant',      occCantVal);
        R('Assessment method',  radio('occCantMethod'));
        if (occCantVal !== 'None') {
          R('Cant side',        radio('occCantSide'));
          R('Cant location',    radio('occCantLocation'));
          R('Suspected origin', radio('occCantOrigin'));
        }
      }

      S('Dental Classification');
      R('Incisors', radio('incisorClass'));
      const br=radio('buccalRight'), bl=radio('buccalLeft');
      if(br||bl) R('Buccal relation', `Right: ${br||'—'}   |   Left: ${bl||'—'}`);

      S('Crowding & Spacing');
      const cU=radio('crowding-upper'), cL=radio('crowding-lower');
      const sU=radio('spacing-upper'),  sL=radio('spacing-lower');
      if(cU||cL) R('Crowding', [cU?`Upper: ${cU}`:'', cL?`Lower: ${cL}`:''].filter(Boolean).join('   |   '));
      if(sU||sL) R('Spacing',  [sU?`Upper: ${sU}`:'', sL?`Lower: ${sL}`:''].filter(Boolean).join('   |   '));

      S('Key Measurements');
      const ojVal=radio('oj'), ojN=get('ojNote');
      R('Overjet (OJ)',   ojVal?(ojN?`${ojVal} (${ojN} mm)`:ojVal):'');
      const obVal=radio('ob'), obN=get('obNote');
      R('Overbite (OB)',  obVal?(obN?`${obVal} (${obN} mm)`:obVal):'');
      R('Curve of Spee', radio('cos'));
      const txVal=get('transverse'), txN=get('transverseNote');
      R('Transverse',    txVal?(txN?`${txVal} (${txN})`:txVal):'');
      const uM=radio('upperMid'), uN=get('upperMidNote');
      const lM=radio('lowerMid'), lN=get('lowerMidNote');
      R('Upper midline', uM?[uM,uN?uN+' mm':''].filter(Boolean).join(', '):'');
      R('Lower midline', lM?[lM,lN?lN+' mm':''].filter(Boolean).join(', '):'');

      // Dental chart
      const gC={carious:[],rcted:[],missing:[],restored:[]};
      [...upperTeeth,...lowerTeeth].forEach(n=>{ const st=toothStates[toothState[n]]; if(st!=='normal') gC[st].push(toothLabel(n)); });
      if(Object.values(gC).some(a=>a.length)||get('chartNotes')){
        S('Dental Chart');
        if(gC.carious.length)  R('Carious teeth',       gC.carious.join(', '));
        if(gC.rcted.length)    R('RCTed teeth',          gC.rcted.join(', '));
        if(gC.missing.length)  R('Missing teeth',        gC.missing.join(', '));
        if(gC.restored.length) R('Restored / Crowned',   gC.restored.join(', '));
        R('Notes', get('chartNotes'));
      }

      S('Periodontal & Soft Tissue');
      R('Gingival biotype', radio('ginBiotype'));
      R('Oral hygiene',     radio('oralHygiene'));
      R('Gingival health',  radio('ginHealth'));
      R('Tongue', [radio('tongueSize'),radio('tongueScallop')].filter(Boolean).join(', '));
      const fren=[];
      if(isChk('frenal-upper'))   fren.push('High upper labial frenum');
      if(isChk('frenal-lower'))   fren.push('Low lower labial frenum');
      if(isChk('frenal-lingual')) fren.push('Tongue tie');
      if(fren.length) R('Frenal attachments', fren.join(', '));
      R('Perio notes', get('perioNotes'));

      const hab=[];
      if(isChk('habit-nil'))          hab.push('None identified');
      if(isChk('habit-thumbsuck'))    hab.push('Thumb sucking');
      if(isChk('habit-dummy'))        hab.push('Dummy use');
      if(isChk('habit-nailbite'))     hab.push('Nail biting');
      if(isChk('habit-liplick'))      hab.push('Lip licking');
      if(isChk('habit-mouthbreathe')) hab.push('Mouth breathing');
      if(isChk('habit-tongue'))       hab.push('Tongue thrusting');
      if(isChk('habit-brux'))         hab.push('Bruxism');
      if(isChk('habit-pencil'))       hab.push('Pencil biting');
      if(hab.length||get('habitNotes')){ S('Habits'); if(hab.length) R('Habits', hab.join(', ')); R('Notes', get('habitNotes')); }

      S('Radiographic Findings — OPG');
      R('Bone level',           radio('boneLevel'));
      R('Condylar morphology',  radio('condylar'));
      R('Root morphology',      radio('rootMorph'));
      const ws=[];
      if(isChk('wis-18'))ws.push('18'); if(isChk('wis-28'))ws.push('28');
      if(isChk('wis-38'))ws.push('38'); if(isChk('wis-48'))ws.push('48');
      if(ws.length) R('Third molars present', ws.join(', '));
      R('Unerupted / Impacted', get('unerupted'));
      R('OPG notes', get('radioNotes'));

      const recs=[];
      if(isChk('rec-photos')) recs.push('Clinical photographs');
      if(isChk('rec-opg'))    recs.push('OPG');
      if(isChk('rec-ceph'))   recs.push('Lateral cephalogram');
      if(isChk('rec-iopa'))   recs.push('IOPA');
      if(isChk('rec-cbct'))   recs.push('CBCT');
      if(isChk('rec-models')) recs.push('Study models');
      if(isChk('rec-scan'))   recs.push('Intraoral scan');
      if(isChk('rec-consent'))recs.push('Consent signed');
      if(isChk('rec-video'))  recs.push('Intraoral video');
      if(recs.length||isChk('aseptic-confirm')){
        S('Records & Aseptic');
        if(recs.length) R('Records taken', recs.join(', '));
        if(isChk('aseptic-confirm')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      }

      S('Assessment & Plan');
      R('Diagnosis',         get('diagnosis'));
      R('Referral',          get('referral'));
      R('Next visit purpose',get('nextVisitPurpose'));
      R('Cost',              get('cost')?'SAR '+get('cost'):'');
      R('Notes',             get('addNotes'));
      break;
    }

    // ══════════════════════════════════════
    case 'plan': {
      S('Treatment Plan');
      R('Patient',   get('plan-name'));
      R('Age',       get('plan-age')?get('plan-age')+' years':'');
      R('Clinician', get('plan-clinician'));
      R('Date',      get('plan-date'));

      const appType = document.querySelector('[name="plan-appliance-type"]:checked')?.value||'';
      S('Appliance & Prescription');
      if(appType==='fixed'){
        R('Treatment type',     get('plan-tx-type'));
        R('Slot',               radio('plan-slot'));
        R('Prescription',       radio('plan-rx'));
        R('Brand',              radio('plan-brand'));
        R('Arch coverage',      radio('plan-arch-cov'));
        R('Bracket modification',get('plan-bracket-mod'));
      } else if(appType==='aligner'){
        R('System',             get('plan-aligner-brand'));
        R('Scope',              radio('plan-aligner-scope'));
        R('Est. aligners',      get('plan-aligner-count'));
      } else if(appType==='gmd'){
        gmdPlanSummaryLines().forEach(line => {
          const trimmed = line.trim().replace(/^·\s*/,'');
          const colonIdx = trimmed.indexOf(':');
          if(colonIdx>0) R(trimmed.slice(0,colonIdx).trim(), trimmed.slice(colonIdx+1).trim());
          else if(trimmed) RB(trimmed);
        });
      }

      S('Anchorage & Extractions');
      R('Anchorage requirement', radio('plan-anch'));
      const ar=[];
      if(isChk('plan-anch-tad'))ar.push('TADs'); if(isChk('plan-anch-hg'))ar.push('Headgear');
      if(isChk('plan-anch-tpa'))ar.push('TPA/Nance'); if(isChk('plan-anch-elastic'))ar.push('Elastics');
      if(ar.length) R('Anchorage reinforcement', ar.join(', '));
      const extVal = radio('plan-ext');
      if (extVal === 'Other') {
        const teeth = [...extChartSet].sort((a,b)=>a-b).map(n=>toothLabel(n));
        R('Extractions', teeth.length ? teeth.join(', ') : 'Other (no teeth selected)');
      } else {
        R('Extractions', extVal);
      }
      R('Notes',       get('plan-ext-notes'));

      S('Treatment Stages');
      R('Alignment & leveling', get('plan-stage1'));
      R('OJ/OB correction',     get('plan-stage2'));
      R('Finishing',            get('plan-stage3'));
      R('Retention',            get('plan-stage4'));
      R('Estimated duration',   get('plan-duration'));

      S('Clinical Considerations');
      const hab2=[];
      if(isChk('plan-habit-thumb')) hab2.push('Thumb sucking');
      if(isChk('plan-habit-mouth')) hab2.push('Mouth breathing');
      if(isChk('plan-habit-tongue'))hab2.push('Tongue thrusting');
      if(isChk('plan-habit-brux'))  hab2.push('Bruxism');
      if(isChk('plan-habit-none'))  hab2.push('None');
      if(hab2.length) R('Habits to address', hab2.join(', '));
      R('Midline',               radio('plan-midline'));
      R('Lip prominence',        radio('plan-lip-prom'));
      R('Facial symmetry goal',  radio('plan-sym'));
      R('Smile line',            radio('plan-smile'));
      R('Referrals',             get('plan-referral'));
      R('Plan details',          get('plan-details'));

      S('Financial Plan');
      R('Total cost',    get('plan-cost-total')?'SAR '+get('plan-cost-total'):'');
      R('First payment', get('plan-cost-first')?'SAR '+get('plan-cost-first'):'');
      R('Monthly payment',get('plan-cost-monthly')?'SAR '+get('plan-cost-monthly'):'');
      R('Payment notes', get('plan-cost-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'bond': {
      S('Bond-Up Visit');
      R('Patient',   get('bond-name'));
      R('Visit #',   get('bond-visit-no'));
      R('Date',      get('bond-date'));
      R('Clinician', get('bond-clinician'));

      const bondType = document.querySelector('[name="bond-type"]:checked')?.value||'';
      if(bondType==='fixed'){
        S('Fixed Appliance Bonding');
        const sumTxt = document.getElementById('bond-fixed-summary')?.textContent||'';
        if(sumTxt) RB(sumTxt);
        R('Upper archwire', getWireText('bond-wire-selector','upper'));
        R('Lower archwire', getWireText('bond-wire-selector','lower'));
        const ax=[];
        if(isChk('bond-aux-spring'))ax.push('Open coil spring');
        if(isChk('bond-aux-chain'))ax.push('Elastic chain');
        if(isChk('bond-aux-bite-ramp'))ax.push('Bite ramps');
        if(isChk('bond-aux-lace'))ax.push('Lacebacks');
        if(isChk('bond-aux-piggyback'))ax.push('Piggyback wire');
        if(ax.length) R('Auxiliaries', ax.join(', '));
        R('Bracket notes', get('bond-bracket-notes'));
      } else if(bondType==='aligner'){
        S('Aligner Start Session');
        R('Total aligners',  get('bond-total-aligners'));
        R('Aligners given',  get('bond-aligners-given'));
        R('Wear protocol',   radio('bond-aligner-wear'));
        R('Attachments',     get('bond-attachments'));
        R('Buttons',         get('bond-buttons'));
        R('IPR',             radio('bond-ipr'));
        R('IPR details',     get('bond-ipr-notes'));
      }

      S('Elastics & Instructions');
      if(radio('bond-elastic-config')==='asymmetric'){
        R('Elastics — Right', [radio('bond-elastic-r'),radio('bond-el-size-r'),radio('bond-el-force-r')].filter(Boolean).join(' — '));
        R('Elastics — Left',  [radio('bond-elastic-l'),radio('bond-el-size-l'),radio('bond-el-force-l')].filter(Boolean).join(' — '));
      } else {
        R('Elastics', elasticText('bond-elastic','bond-el-size','bond-el-force'));
      }
      R('Elastic notes', get('bond-elastic-notes'));
      if(isChk('bond-elastic-inst')) R('Elastic instructions','Proper use and timing instructed to the patient');
      R('Oral hygiene',  radio('bond-oh'));
      const inst=[];
      if(isChk('bond-inst-appliance'))inst.push('Appliance instructions');
      if(isChk('bond-inst-elastic'))  inst.push('Elastic use');
      if(isChk('bond-inst-aligner'))  inst.push('Aligner instructions');
      if(isChk('bond-inst-diet'))     inst.push('Dietary restrictions');
      if(inst.length) R('Instructions given', inst.join(', '));
      R('Next visit',  get('bond-nv'));
      R('Referral',    get('bond-referral'));
      if(isChk('bond-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes',       get('bond-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'fu-fixed': {
      S('Fixed Follow-Up Visit');
      R('Patient',   get('fuf-name'));
      R('Visit #',   get('fuf-visit-no'));
      R('Date',      get('fuf-date'));
      R('Clinician', get('fuf-clinician'));

      // Bond / Rebond
      const rbList = rebondActions.filter(a=>isChk(a));
      if(rbList.length){
        S('Bond / Re-bond / Replace');
        rbList.forEach(a => {
          const teeth=[...rebondChartSets[a]].sort((x,y)=>x-y).map(n=>toothLabel(n)).join(', ');
          RB(teeth ? `${rebondLabels[a]} on ${teeth}` : rebondLabels[a]);
        });
        R('Reason for failure', radio('fuf-rebond-reason'));
        R('Notes',              get('fuf-rebond-notes'));
      }

      S('Archwires');
      // Upper
      const upperLines=[];
      const uw=getWireText('fuf-wire-selector','upper');
      if(uw) upperLines.push('Archwire: '+uw);
      if(isChk('fuf-aux-wire-upper-en')){const auw=getWireText('fuf-aux-wire-upper','upper');if(auw)upperLines.push('Auxiliary: '+auw);}
      if(get('fuf-wire-notes-upper')) upperLines.push('Notes: '+get('fuf-wire-notes-upper'));
      const ligU=[];
      const rU=radio('fuf-lig-upper'); if(rU) ligU.push(rU);
      if(isChk('fuf-lig-upper-short')){const t=[...ligSelectedTeeth.upper.short].sort((a,b)=>a-b).map(n=>toothLabel(n)).join(', ');ligU.push('Short ligature'+(t?' on '+t:''));}
      if(isChk('fuf-lig-upper-fig8')) {const t=[...ligSelectedTeeth.upper.fig8].sort((a,b)=>a-b).map(n=>toothLabel(n)).join(', ');ligU.push('Figure of 8'+(t?' on '+t:''));}
      if(ligU.length) upperLines.push('Ligature: '+ligU.join(', '));
      if(upperLines.length) R('Upper', upperLines.join(' · '));

      // Lower
      const lowerLines=[];
      const lw=getWireText('fuf-wire-selector','lower');
      if(lw) lowerLines.push('Archwire: '+lw);
      if(isChk('fuf-aux-wire-lower-en')){const alw=getWireText('fuf-aux-wire-lower','lower');if(alw)lowerLines.push('Auxiliary: '+alw);}
      if(get('fuf-wire-notes-lower')) lowerLines.push('Notes: '+get('fuf-wire-notes-lower'));
      const ligL=[];
      const rL=radio('fuf-lig-lower'); if(rL) ligL.push(rL);
      if(isChk('fuf-lig-lower-short')){const t=[...ligSelectedTeeth.lower.short].sort((a,b)=>a-b).map(n=>toothLabel(n)).join(', ');ligL.push('Short ligature'+(t?' on '+t:''));}
      if(isChk('fuf-lig-lower-fig8')) {const t=[...ligSelectedTeeth.lower.fig8].sort((a,b)=>a-b).map(n=>toothLabel(n)).join(', ');ligL.push('Figure of 8'+(t?' on '+t:''));}
      if(ligL.length) lowerLines.push('Ligature: '+ligL.join(', '));
      if(lowerLines.length) R('Lower', lowerLines.join(' · '));

      S('Active Mechanics');
      R('Treatment stage', radio('fuf-stage'));
      const ax2=[];
      if(isChk('fuf-aux-chain'))     ax2.push('Elastic chain');
      if(isChk('fuf-aux-spring'))    ax2.push('Open coil spring');
      if(isChk('fuf-aux-tad'))       ax2.push('TAD force');
      if(isChk('fuf-aux-powerarm'))  ax2.push('Power arm');
      if(isChk('fuf-aux-tpa'))       ax2.push('TPA/Nance');
      if(isChk('fuf-aux-bite-plate'))ax2.push('Bite plate');
      if(ax2.length) R('Auxiliaries', ax2.join(', '));
      if(radio('fuf-elastic-config')==='asymmetric'){
        R('Elastics — Right', [radio('fuf-elastic-r'),radio('fuf-el-size-r'),radio('fuf-el-force-r')].filter(Boolean).join(' — '));
        R('Elastics — Left',  [radio('fuf-elastic-l'),radio('fuf-el-size-l'),radio('fuf-el-force-l')].filter(Boolean).join(' — '));
      } else {
        R('Elastics', elasticText('fuf-elastic','fuf-el-size','fuf-el-force'));
      }
      R('Elastic notes', get('fuf-elastic-notes'));
      if(isChk('fuf-elastic-inst')) R('Elastic instructions','Proper use and timing instructed to the patient');
      R('Mechanics notes', get('fuf-mech-notes'));

      S('Progress Assessment');
      R('Alignment progress', radio('fuf-align-prog'));
      R('Patient compliance', radio('fuf-compliance'));
      R('Oral hygiene',       radio('fuf-oh'));
      if(isChk('fuf-has-tad') && fuTadState['fuf'].length){
        S('TAD / Mini-screw Status');
        fuTadSummaryLines('fuf').forEach(line => RB(line));
      }

      S('Visit Completion');
      R('Next visit', get('fuf-nv'));
      R('Referral',   get('fuf-referral'));
      if(isChk('fuf-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes',      get('fuf-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'fu-aligner': {
      S('Aligner Follow-Up Visit');
      R('Patient',   get('fua-name'));
      R('Visit #',   get('fua-visit-no'));
      R('Date',      get('fua-date'));
      R('Clinician', get('fua-clinician'));

      S('Aligner Progress');
      const cur=get('fua-current-aligner'), tot=get('fua-total-aligners');
      if(cur||tot) R('Current aligner', `#${cur} of ${tot}`);
      if(cur&&tot){ const pct=Math.min(100,Math.round((parseInt(cur)||0)/(parseInt(tot)||1)*100)); R('Progress', pct+'% complete'); }
      R('Aligners given',   get('fua-given'));
      R('Tracking',         radio('fua-tracking'));
      R('Non-tracking teeth',get('fua-nontrack'));

      S('Procedures This Visit');
      R('IPR',        radio('fua-ipr'));
      R('IPR details',get('fua-ipr-detail'));
      const att=[];
      if(isChk('fua-att-add'))    att.push('Added');
      if(isChk('fua-att-remove')) att.push('Removed');
      if(isChk('fua-att-replace'))att.push('Replaced');
      if(isChk('fua-att-none'))   att.push('No change');
      if(att.length) R('Attachments', att.join(', '));
      R('Attachment details', get('fua-att-notes'));
      const btn2=[];
      if(isChk('fua-btn-add'))    btn2.push('Added');
      if(isChk('fua-btn-remove')) btn2.push('Removed');
      if(isChk('fua-btn-none'))   btn2.push('No change');
      if(btn2.length) R('Buttons', btn2.join(', '));
      R('Button details', get('fua-btn-notes'));
      if(radio('fua-elastic-config')==='asymmetric'){
        R('Elastics — Right',[radio('fua-elastic-r'),radio('fua-el-size-r'),radio('fua-el-force-r')].filter(Boolean).join(' — '));
        R('Elastics — Left', [radio('fua-elastic-l'),radio('fua-el-size-l'),radio('fua-el-force-l')].filter(Boolean).join(' — '));
      } else {
        R('Elastics', elasticText('fua-elastic','fua-el-size','fua-el-force'));
      }
      R('Elastic notes', get('fua-elastic-notes'));
      if(isChk('fua-elastic-inst')) R('Elastic instructions','Proper use and timing instructed to the patient');

      S('Visit Completion');
      R('Oral hygiene',      radio('fua-oh'));
      R('Wear compliance',   radio('fua-wear-comply'));
      if(isChk('fua-has-tad') && fuTadState['fua'].length){
        S('TAD / Mini-screw Status');
        fuTadSummaryLines('fua').forEach(line => RB(line));
      }
      R('Next visit', get('fua-nv'));
      R('Referral',   get('fua-referral'));
      if(isChk('fua-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes',      get('fua-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'fu-gmd': {
      S('Growth Modification Device Follow-Up');
      R('Patient',   get('fug-name'));
      R('Visit #',   get('fug-visit-no'));
      R('Date',      get('fug-date'));
      R('Clinician', get('fug-clinician'));
      R('Appliance', document.querySelector('[name="fug-appliance-reminder"]:checked')?.value||'');

      S('Progress Assessment');
      R('Compliance',      radio('fug-compliance'));
      R('Reported wear',   get('fug-wear-hrs') ? get('fug-wear-hrs')+' hrs/day' : '');
      R('Patient comfort', radio('fug-comfort'));

      const ojN=get('fug-oj-now'), obN=get('fug-ob-now'), lfhN=get('fug-lfh-now');
      const baseOJ=get('gmd-base-oj'), baseOB=get('gmd-base-ob'), baseLFH=get('gmd-base-lfh');
      if(ojN)  R('OJ now', ojN+' mm'+(baseOJ?' (was '+baseOJ+' mm → change: '+parseFloat((baseOJ-ojN).toFixed(1))+' mm)':''));
      if(obN)  R('OB now', obN+' mm'+(baseOB?' (was '+baseOB+' mm → change: '+parseFloat((baseOB-obN).toFixed(1))+' mm)':''));
      if(lfhN) R('LFH now', lfhN+' mm'+(baseLFH?' (change: '+parseFloat((lfhN-baseLFH).toFixed(1))+' mm)':''));
      R('Molar R', radio('fug-molar-r')); R('Molar L', radio('fug-molar-l'));
      R('Canine R', radio('fug-canine-r')); R('Canine L', radio('fug-canine-l'));
      R('Skeletal response',  radio('fug-skeletal-resp'));
      R('Soft tissue',        radio('fug-soft-tissue'));
      R('Overall progress',   radio('fug-overall'));

      const adjs=[];
      if(isChk('fug-adj-trim'))    adjs.push('Trim bite block');
      if(isChk('fug-adj-activate'))adjs.push('Activate expansion screw');
      if(isChk('fug-adj-advance')) adjs.push('Advance rod');
      if(isChk('fug-adj-new-bite'))adjs.push('New bite registration');
      if(isChk('fug-adj-repair'))  adjs.push('Repair appliance');
      if(isChk('fug-adj-polish'))  adjs.push('Polish / Smooth');
      if(isChk('fug-adj-hg-force'))adjs.push('Adjust HG force');
      if(isChk('fug-adj-replace')) adjs.push('Replace broken component');
      if(isChk('fug-adj-none'))    adjs.push('No adjustment');
      if(adjs.length) R('Adjustments', adjs.join(', '));
      R('Adjustment details', get('fug-adj-notes'));
      R('Oral hygiene',       radio('fug-oh'));

      S('Transition Decision');
      R('Decision', radio('fug-decision'));
      const objs=[];
      if(isChk('fug-obj-oj'))      objs.push('OJ corrected');
      if(isChk('fug-obj-molar'))   objs.push('Molar Class I');
      if(isChk('fug-obj-canine'))  objs.push('Canine Class I');
      if(isChk('fug-obj-skeletal'))objs.push('Skeletal improvement');
      if(isChk('fug-obj-soft'))    objs.push('Soft tissue improvement');
      if(isChk('fug-obj-vert'))    objs.push('Vertical control');
      if(objs.length) R('Objectives achieved', objs.join(', '));
      R('Phase I duration', get('fug-phase-duration'));
      R('Phase II start',   radio('fug-phase2-start'));
      const ret=[];
      if(isChk('fug-ret-same'))  ret.push('Continue as retainer');
      if(isChk('fug-ret-vfr'))   ret.push('VFR / Essix');
      if(isChk('fug-ret-hawley'))ret.push('Hawley');
      if(isChk('fug-ret-none'))  ret.push('None');
      if(ret.length) R('Interim retention', ret.join(', '));
      R('Next visit', get('fug-nv'));
      R('Referral',   get('fug-referral'));
      if(isChk('fug-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes',      get('fug-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'emergency': {
      S('Emergency Visit');
      R('Patient',    get('em-name'));
      R('Pain level', get('em-pain')?get('em-pain')+'/10':'');
      R('Date',       get('em-date'));
      R('Clinician',  get('em-clinician'));

      S('Chief Complaint');
      const emTypes=[...activeEmPills].map(val=>{
        const chartKey=val.replace(/[^a-z0-9]/gi,'-').toLowerCase();
        const teethSet=emChartSets[val];
        const teeth=teethSet?[...teethSet].sort((a,b)=>a-b).map(n=>toothLabel(n)).join(', '):'';
        return teeth?`${val} (${teeth})`:val;
      }).join('; ');
      R('Emergency type',      emTypes);
      R('Tooth / Location',    get('em-tooth'));
      R('Duration of problem', radio('em-duration'));

      S('Treatment Performed');
      const tx=[];
      if(isChk('em-tx-rebond-bracket'))  tx.push('Re-bond bracket');
      if(isChk('em-tx-rebond-tube'))     tx.push('Re-bond molar tube');
      if(isChk('em-tx-rebond-retainer')) tx.push('Re-bond retainer');
      if(isChk('em-tx-cut-wire'))        tx.push('Cut/trim excess wire');
      if(isChk('em-tx-replace-wire'))    tx.push('Replace archwire');
      if(isChk('em-tx-remove-appliance'))tx.push('Remove loose appliance');
      if(isChk('em-tx-wax'))             tx.push('Place wax');
      if(isChk('em-tx-rebond-chain'))    tx.push('Replace elastic chain');
      if(isChk('em-tx-new-aligner'))     tx.push('Issue replacement aligner');
      if(isChk('em-tx-analgesia'))       tx.push('Analgesia advised');
      if(tx.length) R('Actions taken', tx.join(', '));
      const ew=getWireText('em-wire-selector','upper')||getWireText('em-wire-selector','lower');
      if(ew) R('Replacement wire', ew+' — '+(radio('em-wire-arch')||''));
      R('Description', get('em-tx-desc'));

      S('Completion & Follow-Up');
      const inst2=[];
      if(isChk('em-inst-wax'))       inst2.push('Wax use');
      if(isChk('em-inst-diet'))      inst2.push('Soft diet');
      if(isChk('em-inst-analgesic')) inst2.push('OTC analgesic');
      if(isChk('em-inst-callback'))  inst2.push('Call if worsens');
      if(inst2.length) R('Instructions given', inst2.join(', '));
      R('Follow-up plan', radio('em-return'));
      if(isChk('em-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes',    get('em-notes'));
      R('Referral', get('em-referral'));
      break;
    }

    // ══════════════════════════════════════
    case 'debond': {
      S('Debond & Retainer Visit');
      R('Patient',                 get('db-name'));
      R('Total treatment duration',get('db-duration'));
      R('Date',                    get('db-date'));
      R('Clinician',               get('db-clinician'));

      S('Debonding Procedure');
      const rem=[];
      if(isChk('db-remove-full'))    rem.push('Upper and lower fixed appliance de-bonded');
      if(isChk('db-remove-upper'))   rem.push('Upper fixed appliance de-bonded');
      if(isChk('db-remove-lower'))   rem.push('Lower fixed appliance de-bonded');
      if(isChk('db-remove-aligner')) rem.push('Final aligner — clear aligner treatment complete');
      rem.forEach(r=>RB(r));
      const cm=[];
      if(isChk('db-bur-round'))  cm.push('Large round low-speed bur');
      if(isChk('db-bur-fg'))     cm.push('FG bur');
      if(isChk('db-polishing'))  cm.push('Polishing discs/pumice');
      if(isChk('db-scaler'))     cm.push('Ultrasonic scaler');
      if(cm.length) R('Composite removal', cm.join(', '));
      R('Enamel condition', radio('db-enamel'));
      const imp=[];
      if(isChk('db-imp-alginate'))imp.push('Upper & lower alginate impressions');
      if(isChk('db-imp-scan'))   imp.push('Intraoral scan');
      if(isChk('db-imp-upper'))  imp.push('Upper impression');
      if(isChk('db-imp-lower'))  imp.push('Lower impression');
      if(imp.length) R('Impressions taken', imp.join(', ')+(get('db-imp-purpose')?' — '+get('db-imp-purpose'):''));

      S('Retainers');
      R('Fixed retainer — Upper',  radio('db-fr-upper'));
      R('Fixed retainer — Lower',  radio('db-fr-lower'));
      const rr=[];
      if(isChk('db-rr-vfr'))    rr.push('Vacuum-formed (VFR)');
      if(isChk('db-rr-hawley')) rr.push('Hawley');
      if(isChk('db-rr-spring')) rr.push('Spring retainer');
      if(isChk('db-rr-none'))   rr.push('None at this visit');
      if(rr.length) R('Removable retainer', rr.join(', '));
      R('Removable retainer arch', radio('db-rr-arch'));
      R('Wear protocol',           radio('db-rr-wear'));
      R('Retainer notes',          get('db-retainer-notes'));

      S('Outcome & Discharge');
      R('Treatment objectives', radio('db-outcome'));
      R('Oral hygiene',         radio('db-oh'));
      const di=[];
      if(isChk('db-inst-retainer')) di.push('Retainer wear instructions');
      if(isChk('db-inst-hygiene'))  di.push('Oral hygiene');
      if(isChk('db-inst-emergency'))di.push('Emergency contacts');
      if(isChk('db-inst-review'))   di.push('Annual retention review');
      if(di.length) R('Instructions given', di.join(', '));
      R('Next visit', get('db-nv'));
      R('Referral',   get('db-referral'));
      if(isChk('db-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Treatment summary', get('db-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'referred': {
      S('Referred Patient Assessment');
      R('Patient',   get('ref-name'));
      R('Age',       get('ref-age') ? get('ref-age')+' years' : '');
      R('Clinician', get('ref-clinician'));
      R('Date',      get('ref-date'));

      S('Referral Details');
      R('Referring clinician', get('ref-referring-clinician'));
      R('Referring practice',  get('ref-referring-practice'));
      const reasons = [...document.querySelectorAll('[name="ref-reason"]:checked')].map(e=>e.value);
      R('Reason for referral', reasons.join(', '));
      R('Referral reason details', get('ref-reason-detail'));
      const recs=[];
      if(isChk('ref-rec-opg'))    recs.push('OPG');
      if(isChk('ref-rec-ceph'))   recs.push('Lateral cephalogram');
      if(isChk('ref-rec-photos')) recs.push('Clinical photographs');
      if(isChk('ref-rec-models')) recs.push('Study models / scans');
      if(isChk('ref-rec-plan'))   recs.push('Previous treatment plan');
      if(isChk('ref-rec-letter')) recs.push('Referral letter');
      if(isChk('ref-rec-consent'))recs.push('Previous consent forms');
      if(isChk('ref-rec-xrays')) recs.push('Periapical X-rays');
      if(isChk('ref-rec-none'))   recs.push('No records received');
      if(recs.length) R('Records received', recs.join(', '));
      R('Records quality',    radio('ref-rec-quality'));
      R('New records required', get('ref-new-records'));

      S('Previous Treatment History');
      R('Previous appliance',   radio('ref-prev-appliance'));
      R('Previous prescription', radio('ref-prev-rx'));
      R('Previous slot size',   radio('ref-prev-slot'));
      R('Duration of previous treatment', get('ref-prev-duration'));
      R('Approx. visits',       get('ref-prev-visits'));
      R('Assessment interval',  get('ref-prev-interval'));
      R('Stage at transfer',    radio('ref-prev-stage'));
      const prevExt = radio('ref-prev-ext');
      if (prevExt === 'Other') {
        const teeth = [...refExtChartSet].sort((a,b)=>a-b).map(n=>toothLabel(n));
        R('Extractions performed', teeth.length ? 'Other — '+teeth.join(', ') : 'Other (no teeth selected)');
      } else {
        R('Extractions performed', prevExt + (get('ref-prev-ext-detail') ? ' — '+get('ref-prev-ext-detail') : ''));
      }
      const aux=[];
      if(isChk('ref-aux-tad'))        aux.push('TADs / mini-screws');
      if(isChk('ref-aux-elastics'))   aux.push('Elastics');
      if(isChk('ref-aux-hg'))         aux.push('Headgear');
      if(isChk('ref-aux-functional')) aux.push('Fixed functional');
      if(isChk('ref-aux-tpa'))        aux.push('TPA / Nance');
      if(isChk('ref-aux-none'))       aux.push('None documented');
      if(aux.length) R('Active auxiliaries at transfer', aux.join(', '));
      R('Auxiliary details', get('ref-aux-detail'));
      R('Previous compliance', radio('ref-prev-compliance'));
      R('Previous treatment summary', get('ref-prev-summary'));

      S('Clinical Assessment at Transfer');
      R('Appliance condition', radio('ref-appliance-cond'));
      R('Bracket integrity',   radio('ref-bracket-cond'));
      const rwU = getWireText('ref-wire-selector','upper');
      const rwL = getWireText('ref-wire-selector','lower');
      if(rwU) R('Archwire — Upper', rwU);
      if(rwL) R('Archwire — Lower', rwL);
      R('Wire appropriateness', radio('ref-wire-appropriate'));
      const ojV=get('ref-oj-val'), ojS=radio('ref-oj-status');
      R('Overjet at transfer',  [ojS, ojV?ojV+' mm':''].filter(Boolean).join(' — '));
      const obV=get('ref-ob-val'), obS=radio('ref-ob-status');
      R('Overbite at transfer', [obS, obV?obV+' mm':''].filter(Boolean).join(' — '));
      const bR=radio('ref-buccal-r'), bL=radio('ref-buccal-l');
      if(bR||bL) R('Buccal relation', `Right: ${bR||'—'}   |   Left: ${bL||'—'}`);
      R('Upper midline', radio('ref-upper-mid'));
      R('Lower midline', radio('ref-lower-mid'));
      R('White spot lesions', radio('ref-wsl'));
      R('Periodontal status', radio('ref-perio'));
      R('Root resorption',    radio('ref-root-resorption'));
      R('Root parallelism',   radio('ref-root-parallel'));
      R('Clinical notes',     get('ref-clinical-notes'));

      S('Treatment Progress Audit');
      R('Original objectives', get('ref-orig-objectives'));
      const objs=[];
      if(isChk('ref-obj-align'))     objs.push('Alignment completed');
      if(isChk('ref-obj-level'))     objs.push('Leveling completed');
      if(isChk('ref-obj-space'))     objs.push('Space closure completed');
      if(isChk('ref-obj-oj'))        objs.push('OJ correction completed');
      if(isChk('ref-obj-ob'))        objs.push('OB correction completed');
      if(isChk('ref-obj-midline'))   objs.push('Midline corrected');
      if(isChk('ref-obj-transverse'))objs.push('Transverse corrected');
      if(isChk('ref-obj-molar'))     objs.push('Molar Class I achieved');
      if(isChk('ref-obj-none'))      objs.push('None completed yet');
      if(objs.length) R('Objectives achieved so far', objs.join(', '));
      R('Estimated remaining time', radio('ref-remaining-time'));
      R('Complexity at transfer',   radio('ref-complexity'));

      S('Clinical Decision');
      R('Treatment decision', radio('ref-decision'));
      const mods=[];
      if(isChk('ref-mod-rebracket'))   mods.push('Change bracket prescription / re-bracket');
      if(isChk('ref-mod-reposition'))  mods.push('Bracket repositioning');
      if(isChk('ref-mod-extract'))     mods.push('Extract teeth not previously extracted');
      if(isChk('ref-mod-tad'))         mods.push('Add TAD / mini-screw anchorage');
      if(isChk('ref-mod-retention'))   mods.push('Modify retention plan');
      if(isChk('ref-mod-objectives'))  mods.push('Alter finishing objectives (compromise)');
      if(isChk('ref-mod-perio'))       mods.push('Perio treatment required');
      if(isChk('ref-mod-restorative')) mods.push('Restorative work required');
      if(mods.length) R('Modifications required', mods.join(', '));
      R('Modification details', get('ref-mod-detail'));
      R('Consent status',       radio('ref-consent'));
      R('Financial arrangement', radio('ref-financial'));
      R('Agreed fee', get('ref-fee') ? 'SAR '+get('ref-fee') : '');

      S('Communication & Documentation');
      R('Communication with referring clinician', radio('ref-comm'));
      R('Patient / parent concerns', get('ref-patient-concerns'));
      R('Plan moving forward',        get('ref-plan-forward'));
      R('Next visit purpose',         get('ref-next-visit'));
      if(isChk('ref-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Additional notes', get('ref-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'retention': {
      S('Retention Follow-Up Visit');
      R('Patient',          get('ret-name'));
      R('Retention visit #', get('ret-visit-no'));
      R('Clinician',        get('ret-clinician'));
      R('Date',             get('ret-date'));
      R('Time since debond', get('ret-time-since-debond'));

      S('Retention Phase & Protocol');
      R('Current phase', radio('ret-phase'));
      const proto=[];
      if(isChk('ret-proto-fixed-upper')) proto.push('Fixed retainer — Upper');
      if(isChk('ret-proto-fixed-lower')) proto.push('Fixed retainer — Lower');
      if(isChk('ret-proto-vfr'))         proto.push('VFR / Essix');
      if(isChk('ret-proto-hawley'))      proto.push('Hawley retainer');
      if(isChk('ret-proto-spring'))      proto.push('Spring retainer');
      if(proto.length) R('Protocol in place', proto.join(', '));

      S('Fixed Retainer Assessment');
      // Upper
      const frUI = radio('ret-fr-upper-integrity');
      const frUP = radio('ret-fr-upper-plaque');
      if(frUI) {
        const upperTeethSel = [...retChartSets.upper].sort((a,b)=>a-b).map(n=>toothLabel(n));
        const teethStr = upperTeethSel.length ? ` — teeth: ${upperTeethSel.join(', ')}` : '';
        R('Upper fixed retainer — integrity', frUI + teethStr);
      }
      R('Upper — plaque / calculus', frUP);
      // Lower
      const frLI = radio('ret-fr-lower-integrity');
      const frLP = radio('ret-fr-lower-plaque');
      if(frLI) {
        const lowerTeethSel = [...retChartSets.lower].sort((a,b)=>a-b).map(n=>toothLabel(n));
        const teethStr = lowerTeethSel.length ? ` — teeth: ${lowerTeethSel.join(', ')}` : '';
        R('Lower fixed retainer — integrity', frLI + teethStr);
      }
      R('Lower — plaque / calculus', frLP);
      // Actions
      const frActions=[];
      if(isChk('ret-action-rebond'))         frActions.push('Re-bond');
      if(isChk('ret-action-replace-same'))   frActions.push('Replace wire — same design');
      if(isChk('ret-action-replace-diff'))   frActions.push('Replace wire — different design');
      if(isChk('ret-action-sap'))            frActions.push('Scale & polish around retainer');
      if(isChk('ret-action-trim'))           frActions.push('Wire trimmed / adjusted');
      if(isChk('ret-action-none'))           frActions.push('No action required');
      if(isChk('ret-action-remove-patient')) frActions.push('Removed — patient request');
      if(isChk('ret-action-remove-perio'))   frActions.push('Removed — periodontal reasons');
      if(isChk('ret-action-remove-end'))     frActions.push('Removed — planned end of retention');
      if(frActions.length) R('Action taken on fixed retainer', frActions.join(', '));
      R('Wire type used',              radio('ret-wire-type'));
      R('Occlusal interference',       radio('ret-occlusal-interference'));
      R('Fixed retainer notes',        get('ret-fixed-notes'));

      S('Removable Retainer Assessment');
      R('Fit',                    radio('ret-removable-fit'));
      R('Condition',              radio('ret-removable-condition'));
      R('Wear compliance',        radio('ret-wear-compliance'));
      R('Compliance evidence',    radio('ret-compliance-evidence'));
      R('Action taken',           radio('ret-removable-action'));
      R('Removable retainer notes', get('ret-removable-notes'));

      S('Occlusal Stability Assessment');
      R('Upper arch alignment',   radio('ret-align-upper'));
      R('Lower arch alignment',   radio('ret-align-lower'));
      const ojV=get('ret-oj-val'), ojS=radio('ret-oj-status');
      R('Overjet',  [ojV?ojV+' mm':'', ojS].filter(Boolean).join(' — '));
      const obV=get('ret-ob-val'), obS=radio('ret-ob-status');
      R('Overbite', [obV?obV+' mm':'', obS].filter(Boolean).join(' — '));
      const bR=radio('ret-buccal-r'), bL=radio('ret-buccal-l');
      if(bR||bL) R('Buccal occlusion', `Right: ${bR||'—'}   |   Left: ${bL||'—'}`);
      R('Midline', radio('ret-midline'));
      const spVal=radio('ret-spaces'), spDet=get('ret-spaces-detail');
      R('Spaces', spVal?(spDet?`${spVal} — ${spDet}`:spVal):'');
      const risks=[];
      if(isChk('ret-risk-3rd-molar'))    risks.push('Third molar eruption pressure');
      if(isChk('ret-risk-growth'))        risks.push('Continued mandibular growth');
      if(isChk('ret-risk-perio'))         risks.push('Periodontal / bone loss');
      if(isChk('ret-risk-parafunction'))  risks.push('Parafunction');
      if(isChk('ret-risk-habit'))         risks.push('Tongue thrust / lip habit');
      if(isChk('ret-risk-compliance'))    risks.push('Poor retainer compliance');
      if(isChk('ret-risk-failure'))       risks.push('Retainer failure');
      if(isChk('ret-risk-none'))          risks.push('No risk factors identified');
      if(risks.length) R('Relapse risk factors', risks.join(', '));
      R('Overall relapse severity', radio('ret-relapse'));
      const wslVal=radio('ret-wsl');
      const wslTx=[];
      if(isChk('ret-wsl-fluoride')) wslTx.push('Fluoride varnish applied');
      if(isChk('ret-wsl-cppacp'))   wslTx.push('CPP-ACP prescribed');
      R('WSL status', [wslVal, ...wslTx].filter(Boolean).join('; '));

      S('Clinical Decision');
      R('Decision', radio('ret-decision'));
      R('Next visit interval', radio('ret-next-interval'));
      // Discharge criteria
      const dc=[];
      if(isChk('ret-dc-stable'))          dc.push('Occlusion stable ≥2 years');
      if(isChk('ret-dc-lifelong'))        dc.push('Lifelong wear discussed');
      if(isChk('ret-dc-fixed-ok'))        dc.push('Fixed retainer intact');
      if(isChk('ret-dc-removable-given')) dc.push('Removable provided as backup');
      if(isChk('ret-dc-signs'))           dc.push('Signs of relapse discussed');
      if(isChk('ret-dc-gp'))              dc.push('GDP notified');
      if(dc.length) R('Discharge criteria met', dc.join(', '));
      R('Referral', get('ret-referral'));

      S('Visit Completion');
      R('Oral hygiene', radio('ret-oh'));
      R('Patient concerns', get('ret-patient-concerns'));
      if(isChk('ret-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes', get('ret-notes'));
      break;
    }

    // ══════════════════════════════════════
    case 'tad': {
      if(tadActiveScrewIdx >= 0) tadCollectScrew(tadActiveScrewIdx);
      const purposeMap={anch:'Anchorage',intr:'Intrusion',dist:'Distalization',
        retr:'En-masse retraction',molar:'Molar uprighting',midline:'Midline correction',other:'Other'};

      S('TAD / Mini-screw Visit');
      R('Patient',       get('tad-name'));
      R('Visit #',       get('tad-visit-no'));
      R('Date',          get('tad-date'));
      R('Clinician',     get('tad-clinician'));
      if(tadScrews.length) R('Total screws', String(tadScrews.length));

      tadScrews.forEach((sc, i) => {
        S(sc.label+(tadScrews.length>1?' ('+(i+1)+' of '+tadScrews.length+')':''));
        R('Jaw', sc.jaw);
        if(sc.jaw==='Maxilla'){
          R('Site', sc.maxSite);
          if(sc.maxTeeth&&sc.maxTeeth.length) R('Between teeth', sc.maxTeeth.map(n=>toothLabel(n)).join(' & '));
          R('Side',           sc.maxSide||sc.izcSide||'');
          R('IZC vertical',   sc.izcVert);
          R('Palatal position',sc.palatalAP);
        } else {
          R('Site',  sc.mandSite);
          if(sc.mandTeeth&&sc.mandTeeth.length) R('Between teeth', sc.mandTeeth.map(n=>toothLabel(n)).join(' & '));
          R('Side',  sc.mandSide||sc.mandOtherSide||'');
        }
        R('Site notes', sc.siteNotes);
        R('Screw specifications', [sc.diameter,sc.length,sc.head,sc.brand].filter(Boolean).join(' · '));
        if(sc.purposes&&sc.purposes.length) R('Purpose', sc.purposes.map(k=>purposeMap[k]||k).join(', '));
        R('Anaesthesia',        sc.anaes);
        R('Pilot hole',         sc.pilot);
        R('Insertion torque',   sc.torque);
        R('Primary stability',  sc.stability);
        R('Insertion angle',    sc.angle);
        R('Post-insertion X-ray',sc.xray);
        R('Procedure notes',    sc.procNotes);
        R('Loading timing',     sc.loadingTime);
        if(sc.loadingTime && sc.loadingTime!=='Not loaded yet — passive only'){
          R('Force type',       sc.forceType);
          R('Force magnitude',  sc.forceMag);
          R('Force direction',  sc.forceDir);
        }
        R('Loading notes', sc.loadingNotes);
      });

      S('Session Follow-Up');
      R('Next visit', get('tad-nv'));
      R('Referral',   get('tad-referral'));
      if(isChk('tad-aseptic')) RA('Aseptic technique and appropriate PPE were maintained and observed throughout the entire procedure. Confirmed by Clinician.');
      R('Notes',      get('tad-notes'));
      break;
    }
  }

  return sections.filter(s => s.rows.length > 0);
}

// ── Render sections as plain text (for clipboard) ──────────────────────
function renderAsText(sections) {
  const lines = [];
  sections.forEach(sec => {
    lines.push('\n' + sec.title);
    sec.rows.forEach(r => {
      if(r.aseptic) lines.push('  🛡️ ' + r.value);
      else if(r.bold) lines.push('  · ' + r.value);
      else lines.push('  · ' + r.label + ': ' + r.value);
    });
  });
  return lines.join('\n').trim();
}

// ── Render sections as print HTML ─────────────────────────────────────
function pe(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}



function getCurrentSummary() {
  const sections = collectFormData(currentTab);
  return renderAsText(sections);
}


// ── Toast ──────────────────────────────────────────────────────────────
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent=msg; t.className='toast '+type;
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ── Copy ───────────────────────────────────────────────────────────────
async function copyCurrentSummary() {
  const text = getCurrentSummary();
  if(!text||text.length<10){ showToast('⚠️ Nothing to copy yet','error'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Summary copied to clipboard!','success');
  } catch {
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.cssText='position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try{ document.execCommand('copy'); showToast('✅ Summary copied!','success'); }
    catch{ showToast('❌ Could not copy','error'); }
    document.body.removeChild(ta);
  }
}

// ── Professional Print ─────────────────────────────────────────────────
const TAB_LABELS = {
  'exam':       'Clinical Examination',
  'plan':       'Treatment Plan',
  'bond':       'Bond-Up Visit',
  'fu-fixed':   'Fixed Follow-Up',
  'fu-aligner': 'Aligner Follow-Up',
  'fu-gmd':     'GMD Follow-Up',
  'emergency':  'Emergency Visit',
  'debond':     'Debond & Retainer',
  'tad':        'TAD / Mini-screw',
  'referred':   'Referred Patient Assessment',
  'retention':  'Retention Follow-Up',
};


function buildPrintSections() {
  return collectFormData(currentTab);
}


function buildPrintHTML() {
  const sections = buildPrintSections();
  if (!sections || !sections.length) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  const visitLabel = TAB_LABELS[currentTab] || currentTab;
  const notationLabel = NOTATION === 'Universal' ? 'Universal (ADA)' : NOTATION;
  const clinicEl = document.getElementById('clinic-name-display');
  const clinicName = (clinicEl && clinicEl.textContent !== 'Orthodontic Clinical Records')
    ? clinicEl.textContent : 'EasyOrtho';

  let sectionsHTML = sections.map(sec => {
    const rowsHTML = sec.rows.map(r => {
      if (r.aseptic) {
        return `<div class="print-aseptic">🛡️ <span>${pe(r.value)}</span></div>`;
      }
      if (r.bold) {
        return `<div class="print-row"><span class="print-label"></span><span class="print-value" style="font-weight:600;color:#0d1b2a;">${pe(r.value)}</span></div>`;
      }
      return `<div class="print-row">
        <span class="print-label">${r.label ? pe(r.label)+':' : ''}</span>
        <span class="print-value">${pe(r.value)}</span>
      </div>`;
    }).join('');
    return `<div class="print-section">
      <div class="print-section-title">${pe(sec.title)}</div>
      ${rowsHTML}
    </div>`;
  }).join('');

  return `
    <div class="print-header">
      <div class="print-logo">
        <div class="print-logo-icon" style="background:none;padding:0;overflow:hidden;"><img src="data:image/png;base64,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" alt="" style="width:38px;height:38px;display:block;"></div>
        <div class="print-logo-text">
          <span class="print-logo-title">${pe(clinicName)}</span>
          <span class="print-logo-sub">Clinical Documentation · Notation: ${notationLabel}</span>
        </div>
      </div>
      <div class="print-meta">
        <strong>${dateStr}</strong>
        Printed at ${timeStr}
      </div>
    </div>
    <div class="print-visit-badge">${visitLabel}</div>
    ${sectionsHTML}
    <div style="display:flex;justify-content:flex-end;margin-top:24px;">
      <div class="print-sig-box">Clinician Signature</div>
    </div>
    <div class="print-footer">
      <span>Dr. Mohammed Homam Alsamman — EasyOrtho System</span>
      <span>© ${now.getFullYear()} All Rights Reserved</span>
    </div>
    <div class="print-confidential">⚠ Confidential Medical Record — Not for Unauthorized Distribution</div>
  `;
}

function printSummary() {
  const html = buildPrintHTML();
  if (!html) { showToast('⚠️ Nothing to print yet','error'); return; }

  // ── فتح نافذة طباعة منفصلة مع styles مضمنة ─────────────────────────
  // هذا يضمن أن الـ CSS يعمل بغض النظر عن كيفية تحميل الملفات
  const printWin = window.open('', '_blank', 'width=900,height=700');
  if (!printWin) {
    // fallback: استخدام الـ overlay إذا منع المتصفح النافذة الجديدة
    const overlay = document.getElementById('print-overlay');
    const doc     = document.getElementById('print-doc-content');
    doc.innerHTML = html;
    overlay.classList.add('preview-mode');
    setTimeout(() => {
      overlay.classList.remove('preview-mode');
      overlay.style.display = 'block';
      window.print();
      overlay.style.display = '';
      doc.innerHTML = '';
    }, 220);
    return;
  }

  // جلب الـ CSS الخارجي وتضمينه في نافذة الطباعة
  fetch('./app.css')
    .then(r => r.text())
    .then(css => {
      printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EasyOrtho — Clinical Summary</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
${css}
/* ── Override للطباعة: إظهار كل شيء ── */
body > * { display: block !important; }
#print-overlay { display: block !important; position: static !important; }
body { background: white !important; }
</style>
</head>
<body>
<div id="print-overlay" style="display:block;position:static;">
  <div class="print-doc">
    ${html}
  </div>
</div>
</body>
</html>`);
      printWin.document.close();
      // انتظر تحميل الـ fonts ثم اطبع
      printWin.onload = () => {
        setTimeout(() => {
          printWin.focus();
          printWin.print();
          setTimeout(() => printWin.close(), 1000);
        }, 600);
      };
      // fallback إذا لم يُطلق onload
      setTimeout(() => {
        if (!printWin.closed) {
          printWin.focus();
          printWin.print();
          setTimeout(() => printWin.close(), 1000);
        }
      }, 1500);
    })
    .catch(() => {
      // إذا فشل جلب CSS، اطبع بدونه
      printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EasyOrtho</title></head><body>${html}</body></html>`);
      printWin.document.close();
      setTimeout(() => { printWin.print(); setTimeout(() => printWin.close(), 500); }, 400);
    });
}

// ── Save / Load / Clear ────────────────────────────────────────────────
function saveCurrentForm() {
  const panel = document.querySelector('.tab-panel.active');
  const data  = { _tab: currentTab };
  panel.querySelectorAll('input,select,textarea').forEach(el=>{
    if(!el.id&&!el.name) return;
    if(el.type==='checkbox') data[el.id]=el.checked;
    else if(el.type==='radio'){ if(el.checked) data['radio__'+el.name]=el.value; }
    else if(el.id) data[el.id]=el.value;
  });
  // Save wire states for this panel
  ['bond-wire-selector','fuf-wire-selector','em-wire-selector','ref-wire-selector'].forEach(cid=>{
    if(wireState[cid]) data['wires__'+cid]=wireState[cid];
  });
  if(currentTab==='fu-fixed'){
    // FIX: save short and fig8 sets separately as arrays
    data['_lig_upper_short']=[...ligSelectedTeeth.upper.short];
    data['_lig_upper_fig8']=[...ligSelectedTeeth.upper.fig8];
    data['_lig_lower_short']=[...ligSelectedTeeth.lower.short];
    data['_lig_lower_fig8']=[...ligSelectedTeeth.lower.fig8];
    // Aux wire states
    ['upper','lower'].forEach(arch=>{
      const cid=`fuf-aux-wire-${arch}`;
      if(wireState[cid]) data['wires__'+cid]=wireState[cid];
    });
  }
  if(currentTab==='emergency') data['_em_pills']=[...activeEmPills];
  if(currentTab==='fu-fixed')  data['_fu_tad_fuf']=fuTadState['fuf'];
  if(currentTab==='fu-aligner') data['_fu_tad_fua']=fuTadState['fua'];
  if(currentTab==='plan') data['_ext_chart']=[...extChartSet];
  if(currentTab==='referred') data['_ref_ext_chart']=[...refExtChartSet];
  if(currentTab==='retention'){
    data['_ret_chart_upper']=[...retChartSets.upper];
    data['_ret_chart_lower']=[...retChartSets.lower];
  }
  if(currentTab==='exam') data['__teeth']={...toothState};
  localStorage.setItem('ortho_v4_'+currentTab, JSON.stringify(data));
  showToast('💾 Draft saved!','success');
}

function loadForm(tab) {
  const saved = localStorage.getItem('ortho_v4_'+tab);
  if(!saved) return;
  const data = JSON.parse(saved);
  const panel = document.getElementById('panel-'+tab);
  if(!panel) return;

  Object.keys(data).forEach(key=>{
    if(key==='_tab') return;
    if(key.startsWith('wires__')){
      const cid = key.slice(7);
      const ws = data[key];
      if(ws && wireState[cid]){
        ['upper','lower'].forEach(arch=>{
          if(ws[arch]){
            wireState[cid][arch] = ws[arch];
            const wrap = document.getElementById(cid);
            if(wrap){
              if(ws[arch].size){
                const chip = [...wrap.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="size"]`)].find(c=>c.dataset.val===ws[arch].size);
                if(chip){ wrap.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="size"]`).forEach(c=>c.classList.remove('sel-size')); chip.classList.add('sel-size'); }
              }
              if(ws[arch].mat){
                const chip = [...wrap.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="mat"]`)].find(c=>c.dataset.val===ws[arch].mat);
                if(chip){ wrap.querySelectorAll(`.wire-chip[data-arch="${arch}"][data-type="mat"]`).forEach(c=>c.classList.remove('sel-mat')); chip.classList.add('sel-mat'); }
              }
            }
          }
        });
      }
      return;
    }
    if(key==='_ret_chart_upper'){
      retChartSets.upper.clear();
      (data[key]||[]).forEach(n => retChartSets.upper.add(n));
      // Rebuild chart if visible (tab was active)
      setTimeout(() => {
        const intVal = document.querySelector('[name="ret-fr-upper-integrity"]:checked')?.value || '';
        if(intVal && intVal !== 'Intact — all bonding points secure' && intVal !== 'No upper fixed retainer') {
          toggleRetChart('upper');
        }
      }, 100);
      return;
    }
    if(key==='_ret_chart_lower'){
      retChartSets.lower.clear();
      (data[key]||[]).forEach(n => retChartSets.lower.add(n));
      setTimeout(() => {
        const intVal = document.querySelector('[name="ret-fr-lower-integrity"]:checked')?.value || '';
        if(intVal && intVal !== 'Intact — all bonding points secure' && intVal !== 'No lower fixed retainer') {
          toggleRetChart('lower');
        }
      }, 100);
      return;
    }
    if(key==='_ref_ext_chart'){
      refExtChartSet.clear();
      (data[key]||[]).forEach(n => refExtChartSet.add(n));
      // إعادة بناء الـ chart إذا كان Other مختاراً وكان التبويب مرئياً
      const extVal = data['radio__ref-prev-ext'];
      if (extVal === 'Other') {
        setTimeout(() => {
          toggleRefExtChart();
          const lbl = document.getElementById('ref-ext-chart-selected');
          if (lbl) {
            const sorted = [...refExtChartSet].sort((a,b)=>a-b).map(n=>toothLabel(n));
            lbl.textContent = sorted.length ? sorted.join(', ') : '—';
          }
        }, 100);
      }
      return;
    }
    if(key==='_ext_chart'){
      extChartSet.clear();
      (data[key]||[]).forEach(n => extChartSet.add(n));
      // إعادة بناء الـ chart إذا كان Other مختاراً
      const extVal = data['radio__plan-ext'];
      if (extVal === 'Other') {
        setTimeout(() => {
          toggleExtChart();
          const lbl = document.getElementById('plan-ext-chart-selected');
          if (lbl) {
            const sorted = [...extChartSet].sort((a,b)=>a-b).map(n=>toothLabel(n));
            lbl.textContent = sorted.length ? sorted.join(', ') : '—';
          }
        }, 100);
      }
      return;
    }
    if(key==='_fu_tad_fuf'){
      fuTadState['fuf'] = data[key] || [];
      if(isChk('fuf-has-tad')) fuTadRender('fuf');
      return;
    }
    if(key==='_fu_tad_fua'){
      fuTadState['fua'] = data[key] || [];
      if(isChk('fua-has-tad')) fuTadRender('fua');
      return;
    }
    if(key==='_em_pills'){
      data[key].forEach(val=>{
        const pill=document.querySelector(`#em-type-pills [data-val="${val}"]`);
        if(pill){ pill.classList.add('active'); activeEmPills.add(val); }
      });
      return;
    }
    if(key==='_lig_upper_short'||key==='_lig_upper_fig8'||key==='_lig_lower_short'||key==='_lig_lower_fig8'){
      // FIX: restore separate short/fig8 sets
      const parts = key.split('_'); // ['','lig','upper','short'] or similar
      const arch  = key.includes('upper') ? 'upper' : 'lower';
      const type  = key.includes('short') ? 'short' : 'fig8';
      ligSelectedTeeth[arch][type].clear();
      (data[key] || []).forEach(n => ligSelectedTeeth[arch][type].add(n));
      // Re-draw chart if visible
      const chartEl = document.getElementById(`fuf-lig-chart-${arch}`);
      if(chartEl && chartEl.style.display !== 'none') buildLigMiniChart(arch);
      return;
    }
    // Legacy key support (old saved data before fix)
    if(key==='_lig_upper'||key==='_lig_lower'){
      const arch = key==='_lig_upper'?'upper':'lower';
      ligSelectedTeeth[arch].short.clear();
      ligSelectedTeeth[arch].fig8.clear();
      // Put all into short set (best-effort recovery)
      (data[key] || []).forEach(n => ligSelectedTeeth[arch].short.add(n));
      const chartEl = document.getElementById(`fuf-lig-chart-${arch}`);
      if(chartEl && chartEl.style.display !== 'none') buildLigMiniChart(arch);
      return;
    }
    if(key==='__teeth'){
      Object.keys(data[key]).forEach(num=>{
        toothState[num]=data[key][num];
        const btn=document.getElementById('tooth-'+num);
        if(btn){ const st=toothStates[toothState[num]]; btn.className='tooth-btn'+(st!=='normal'?' '+st:''); }
      });
      return;
    }
    if(key.startsWith('radio__')){
      const r=panel.querySelector(`[name="${key.slice(7)}"][value="${data[key]}"]`);
      if(r){ r.checked=true; r.dispatchEvent(new Event('change')); }
    } else {
      const el=document.getElementById(key);
      if(!el) return;
      if(el.type==='checkbox') el.checked=data[key];
      else el.value=data[key];
    }
  });
  updateProgress();
  updateBondSummary();
  // استعادة حالة occ cant details بعد تحميل المسودة
  if(tab==='exam') updateOccCantVisibility();
}

function clearCurrentForm() {
  if(!confirm('Clear all data in this form? This cannot be undone.')) return;

  // ── Step 1: حذف localStorage للتبويب الحالي ──
  localStorage.removeItem('ortho_v4_' + currentTab);

  // ── Step 2: إعادة تهيئة الحالة في الذاكرة ──
  // Wire state
  ['bond-wire-selector','fuf-wire-selector','em-wire-selector'].forEach(cid=>{
    wireState[cid] = { upper:{size:'',mat:''}, lower:{size:'',mat:''} };
  });
  // Ligature sets
  ['upper','lower'].forEach(arch=>{
    ligSelectedTeeth[arch].short.clear();
    ligSelectedTeeth[arch].fig8.clear();
    delete wireState[`fuf-aux-wire-${arch}`];
  });
  // Tooth chart (exam)
  if(currentTab==='exam'){
    [...upperTeeth,...lowerTeeth].forEach(num=>{ toothState[num]=0; });
  }
  // Extraction charts
  extChartSet.clear();
  refExtChartSet.clear();
  // Retention charts
  retChartSets.upper.clear();
  retChartSets.lower.clear();
  // Emergency pills
  activeEmPills.clear();
  Object.keys(emChartSets).forEach(val => emChartSets[val].clear());
  // Rebond chart sets
  Object.keys(rebondChartSets).forEach(a => rebondChartSets[a].clear());
  // Multi-TAD state
  fuTadState['fuf'] = [];
  fuTadState['fua'] = [];
  // TAD screws
  if(currentTab==='tad'){
    tadScrews=[];
    tadActiveScrewIdx=-1;
  }

  // ── Step 3: إعادة رسم DOM كاملاً ──
  const panel = document.querySelector('.tab-panel.active');

  // 3a. كل inputs/selects/textareas
  panel.querySelectorAll('input,select,textarea').forEach(el=>{
    if(el.type==='checkbox'||el.type==='radio') el.checked=false;
    else el.value='';
  });

  // 3b. Wire chips
  panel.querySelectorAll('.wire-chip').forEach(c=>c.classList.remove('sel-size','sel-mat'));

  // 3c. Tooth chart buttons
  panel.querySelectorAll('.tooth-btn').forEach(btn=>{
    btn.className='tooth-btn';
    btn.title='';
  });
  panel.querySelectorAll('.mini-tooth').forEach(btn=>{
    btn.classList.remove('selected');
  });

  // 3d. Ligature charts — إخفاء وتفريغ
  ['upper','lower'].forEach(arch=>{
    const chartEl = document.getElementById(`fuf-lig-chart-${arch}`);
    if(chartEl) chartEl.style.display='none';
    ['short','fig8'].forEach(type=>{
      const row = document.getElementById(`fuf-lig-chart-${arch}-${type}-row`);
      if(row) row.innerHTML='';
      const selEl = document.getElementById(`fuf-lig-${arch}-${type}-selected`);
      if(selEl) selEl.textContent='—';
    });
    // Aux wire
    const auxWrap = document.getElementById(`fuf-aux-wire-${arch}-wrap`);
    if(auxWrap) auxWrap.style.display='none';
    const auxEl = document.getElementById(`fuf-aux-wire-${arch}`);
    if(auxEl) auxEl.innerHTML='';
  });

  // 3e. Rebond charts — إخفاء وتفريغ
  panel.querySelectorAll('[id^="fuf-rebond-"][id$="-chart-wrap"]').forEach(wrap=>{
    wrap.style.display='none';
    const key = wrap.id.replace('-chart-wrap','');
    const row = document.getElementById(key+'-chart-row');
    if(row) row.innerHTML='';
    const sel = document.getElementById(key+'-chart-selected');
    if(sel) sel.textContent='—';
  });

  // 3f. Emergency pills وcharts
  panel.querySelectorAll('.emergency-pill').forEach(p=>p.classList.remove('active'));
  panel.querySelectorAll('[id^="em-chart-wrap-"]').forEach(wrap=>{
    wrap.style.display='none';
    const key = wrap.id.replace('em-chart-wrap-','');
    const row = document.getElementById('em-chart-row-'+key);
    if(row) row.innerHTML='';
    const sel = document.getElementById('em-chart-sel-'+key);
    if(sel) sel.textContent='—';
  });

  // 3g. Extraction chart (plan)
  const extUpper = document.getElementById('plan-ext-chart-upper');
  const extLower = document.getElementById('plan-ext-chart-lower');
  const extWrap  = document.getElementById('plan-ext-chart-wrap');
  const extLbl   = document.getElementById('plan-ext-chart-selected');
  if(extUpper) extUpper.innerHTML='';
  if(extLower) extLower.innerHTML='';
  if(extWrap)  extWrap.style.display='none';
  if(extLbl)   extLbl.textContent='—';

  // 3h. Appliance cards
  panel.querySelectorAll('.appliance-card').forEach(c=>c.classList.remove('selected'));

  // 3i. Plan section visibility
  const pff=document.getElementById('plan-fixed-fields');
  const paf=document.getElementById('plan-aligner-fields');
  const pgf=document.getElementById('plan-gmd-fields');
  if(pff) pff.style.display='';
  if(paf) paf.style.display='none';
  if(pgf) pgf.style.display='none';

  // 3j. Bond sections
  const bfs=document.getElementById('bond-fixed-section');
  const bas=document.getElementById('bond-aligner-section');
  if(bfs) bfs.style.display='';
  if(bas) bas.style.display='none';

  // 3k. GMD sub-sections
  ['gmd-removable-wrap','gmd-fixed-wrap','gmd-headgear-wrap',
   'gmd-detail-twinblock','gmd-detail-herbst','gmd-detail-generic-removable',
   'fug-transition-detail'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });

  // 3l. CS stage highlights
  for(let i=1;i<=6;i++){
    const lbl=document.getElementById('cs-lbl-'+i);
    if(lbl){ lbl.style.borderColor=''; lbl.style.background=''; }
  }

  // 3m. Wire selectors — إعادة بناء
  ['bond-wire-selector','fuf-wire-selector','em-wire-selector'].forEach(cid=>{
    const el=document.getElementById(cid);
    if(el){ el.innerHTML=''; buildWireSelector(cid); }
  });

  // 3n. TAD cards
  const fufCards=document.getElementById('fuf-tad-cards');
  const fuaCards=document.getElementById('fua-tad-cards');
  if(fufCards) fufCards.innerHTML='';
  if(fuaCards) fuaCards.innerHTML='';
  const fufWrap=document.getElementById('fuf-tad-status-wrap');
  const fuaWrap=document.getElementById('fua-tad-status-wrap');
  if(fufWrap) fufWrap.style.display='none';
  if(fuaWrap) fuaWrap.style.display='none';

  // 3o. TAD tab — إعادة بدء بمسمار واحد فارغ
  if(currentTab==='tad'){
    tadAddScrew();
    const tadContainer=document.getElementById('tad-screws-container');
    if(tadContainer) tadContainer.innerHTML='';
    tadScrews=[];
    tadActiveScrewIdx=-1;
    tadAddScrew();
  }

  // 3p. Elastic config — إظهار symmetric بشكل افتراضي
  ['bond','fuf','fua'].forEach(pfx=>{
    const sym=document.getElementById(`${pfx}-elastic-sym`);
    const asy=document.getElementById(`${pfx}-elastic-asym`);
    if(sym) sym.style.display='';
    if(asy) asy.style.display='none';
  });

  // 3q. Aligner progress bar
  const alignerFill=document.getElementById('aligner-fill');
  const alignerPct=document.getElementById('aligner-pct');
  if(alignerFill) alignerFill.style.width='0%';
  if(alignerPct)  alignerPct.textContent='Fill in aligner numbers above';

  // 3r. GMD change indicators
  ['fug-oj-change','fug-ob-change','fug-lfh-change'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent='';
  });

  // ── Step 4: إعادة تفعيل aseptic checkboxes ──
  ['aseptic-confirm','bond-aseptic','fuf-aseptic','fua-aseptic',
   'fug-aseptic','em-aseptic','db-aseptic','tad-aseptic','ref-aseptic','ret-aseptic'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.checked=true;
  });

  // إعادة إخفاء occ cant details عند مسح الـ exam form
  if(currentTab==='exam'){
    const cd=document.getElementById('occ-cant-details');
    if(cd) cd.style.display='none';
  }

  // ── Step 4b: إعادة تهيئة referred tab ──
  if(currentTab==='referred'){
    const dd=document.getElementById('ref-decision-detail');
    if(dd) dd.style.display='none';
    const rws=document.getElementById('ref-wire-selector');
    if(rws && rws.children.length){
      rws.innerHTML=''; delete wireState['ref-wire-selector']; buildWireSelector('ref-wire-selector');
    }
    const refExtWrap  = document.getElementById('ref-ext-chart-wrap');
    const refExtUpper = document.getElementById('ref-ext-chart-upper');
    const refExtLower = document.getElementById('ref-ext-chart-lower');
    const refExtLbl   = document.getElementById('ref-ext-chart-selected');
    if(refExtWrap)  refExtWrap.style.display='none';
    if(refExtUpper) refExtUpper.innerHTML='';
    if(refExtLower) refExtLower.innerHTML='';
    if(refExtLbl)   refExtLbl.textContent='—';
  }

  // ── Step 4c: إعادة تهيئة retention tab ──
  if(currentTab==='retention'){
    // إخفاء discharge wrap و debond charts
    const retDischarge = document.getElementById('ret-discharge-wrap');
    if(retDischarge) retDischarge.style.display='none';
    ['upper','lower'].forEach(arch=>{
      const wrap = document.getElementById(`ret-chart-${arch}-wrap`);
      const row  = document.getElementById(`ret-chart-${arch}-row`);
      const lbl  = document.getElementById(`ret-chart-${arch}-selected`);
      if(wrap) wrap.style.display='none';
      if(row)  row.innerHTML='';
      if(lbl)  lbl.textContent='—';
    });
  }

  // ── Step 5: تحديثات UI نهائية ──
  markSaved(currentTab);
  updateProgress();
  showToast('🗑 Form cleared','success');
}

// ── Auxiliary wire toggle ──────────────────────────────────────────────
function toggleAuxWire(arch) {
  const en   = document.getElementById(`fuf-aux-wire-${arch}-en`);
  const wrap = document.getElementById(`fuf-aux-wire-${arch}-wrap`);
  if (!en || !wrap) return;
  wrap.style.display = en.checked ? 'flex' : 'none';
  if (en.checked && !wireState[`fuf-aux-wire-${arch}`]) {
    buildWireSelectorSingle(`fuf-aux-wire-${arch}`, arch);
  }
}

// Build a single-arch wire selector (no arch label row)
function buildWireSelectorSingle(containerId, arch) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wireState[containerId] = { [arch]: { size:'', mat:'' } };
  const row = document.createElement('div');
  row.className = 'wire-arch-row';
  row.style.gridTemplateColumns = '1fr 1fr';

  const sizeCol = document.createElement('div');
  const sizeHdr = document.createElement('div');
  sizeHdr.className = 'wire-col-label'; sizeHdr.textContent = 'Size';
  const sizeChips = document.createElement('div'); sizeChips.className = 'wire-chips';
  WIRE_SIZES.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'wire-chip'; chip.textContent = s;
    chip.dataset.arch = arch; chip.dataset.type = 'size'; chip.dataset.val = s;
    chip.onclick = () => selectWireChip(containerId, arch, 'size', s, chip);
    sizeChips.appendChild(chip);
  });
  sizeCol.appendChild(sizeHdr); sizeCol.appendChild(sizeChips);

  const matCol = document.createElement('div');
  const matHdr = document.createElement('div');
  matHdr.className = 'wire-col-label'; matHdr.textContent = 'Material';
  const matChips = document.createElement('div'); matChips.className = 'wire-chips';
  WIRE_MATS.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'wire-chip'; chip.textContent = m;
    chip.dataset.arch = arch; chip.dataset.type = 'mat'; chip.dataset.val = m;
    chip.onclick = () => selectWireChip(containerId, arch, 'mat', m, chip);
    matChips.appendChild(chip);
  });
  matCol.appendChild(matHdr); matCol.appendChild(matChips);

  row.appendChild(sizeCol); row.appendChild(matCol);
  wrap.appendChild(row);
}

// ── Universal mini chart builder ──────────────────────────────────────
// selectedSet: a Set of selected FDI numbers
// onUpdate: callback(selectedSet) called on change
function buildMiniChart(containerId, selectedSet, onUpdate, teethSubset) {
  const rowEl = document.getElementById(containerId);
  if (!rowEl) return;
  rowEl.innerHTML = '';

  if (!teethSubset) {
    // Full mouth — two rows with midline, each row scrollable on mobile
    const upperWrap = document.createElement('div');
    upperWrap.className = 'mini-chart-row';
    upperWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;';
    upperTeeth.forEach((num, i) => {
      if (i === 8) { const sp=document.createElement('div'); sp.style.cssText='width:4px;border-left:2px dashed var(--gold);margin:0 1px;flex-shrink:0;'; upperWrap.appendChild(sp); }
      upperWrap.appendChild(makeMiniTooth(num, selectedSet, onUpdate));
    });
    rowEl.appendChild(upperWrap);
    const lowerWrap = document.createElement('div');
    lowerWrap.className = 'mini-chart-row';
    lowerWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
    lowerTeeth.forEach((num, i) => {
      if (i === 8) { const sp=document.createElement('div'); sp.style.cssText='width:4px;border-left:2px dashed var(--gold);margin:0 1px;flex-shrink:0;'; lowerWrap.appendChild(sp); }
      lowerWrap.appendChild(makeMiniTooth(num, selectedSet, onUpdate));
    });
    rowEl.appendChild(lowerWrap);

  } else if (teethSubset === upperTeeth || teethSubset === lowerTeeth) {
    // Single arch — one row with midline at position 8
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
    teethSubset.forEach((num, i) => {
      if (i === 8) { const sp=document.createElement('div'); sp.style.cssText='width:4px;border-left:2px dashed var(--gold);margin:0 1px;'; wrap.appendChild(sp); }
      wrap.appendChild(makeMiniTooth(num, selectedSet, onUpdate));
    });
    rowEl.appendChild(wrap);

  } else {
    // Custom subset (e.g. molars) — single row, group upper then lower
    // Separate upper molars vs lower molars for visual grouping
    const upperM = teethSubset.filter(n => n < 30);
    const lowerM = teethSubset.filter(n => n >= 30);
    if (upperM.length) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:0.62rem;color:var(--grey-400);font-weight:600;align-self:center;margin-right:4px;';
      lbl.textContent = 'Upper:';
      wrap.appendChild(lbl);
      upperM.forEach(num => wrap.appendChild(makeMiniTooth(num, selectedSet, onUpdate)));
      rowEl.appendChild(wrap);
    }
    if (lowerM.length) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:0.62rem;color:var(--grey-400);font-weight:600;align-self:center;margin-right:4px;';
      lbl.textContent = 'Lower:';
      wrap.appendChild(lbl);
      lowerM.forEach(num => wrap.appendChild(makeMiniTooth(num, selectedSet, onUpdate)));
      rowEl.appendChild(wrap);
    }
  }
}

function makeMiniTooth(num, selectedSet, onUpdate) {
  const btn = document.createElement('div');
  btn.className = 'mini-tooth' + (selectedSet.has(num) ? ' selected' : '');
  btn.textContent = toothLabel(num);
  btn.dataset.fdi = num;
  btn.onclick = () => {
    if (selectedSet.has(num)) selectedSet.delete(num);
    else selectedSet.add(num);
    btn.classList.toggle('selected');
    if (onUpdate) onUpdate(selectedSet);
  };
  return btn;
}

function selectedLabel(set) {
  const arr = [...set].sort((a,b)=>a-b);
  return arr.length ? arr.map(n=>toothLabel(n)).join(', ') : '—';
}

// Ligature charts — now one Set per ligature type per arch
const ligSelectedTeeth = {
  upper: { short: new Set(), fig8: new Set() },
  lower: { short: new Set(), fig8: new Set() }
};

// ── Tooth subsets ──────────────────────────────────────────────────────
const molarTeeth = [18,17,16, 26,27,28, 48,47,46, 36,37,38]; // all molars FDI — lower: right→left
const molarActions = new Set([
  'fuf-rebond-tube','fuf-rebond-retube','fuf-rebond-replace-tube'
]);

function buildLigMiniChart(arch) {
  // Use only the teeth of this arch
  const archTeeth = arch === 'upper' ? upperTeeth : lowerTeeth;
  // Short ligature chart
  if (document.getElementById(`fuf-lig-chart-${arch}-short-row`)) {
    buildMiniChart(`fuf-lig-chart-${arch}-short-row`, ligSelectedTeeth[arch].short, () => {
      const el = document.getElementById(`fuf-lig-${arch}-short-selected`);
      if (el) el.textContent = selectedLabel(ligSelectedTeeth[arch].short);
    }, archTeeth);
  }
  // Figure of 8 chart
  if (document.getElementById(`fuf-lig-chart-${arch}-fig8-row`)) {
    buildMiniChart(`fuf-lig-chart-${arch}-fig8-row`, ligSelectedTeeth[arch].fig8, () => {
      const el = document.getElementById(`fuf-lig-${arch}-fig8-selected`);
      if (el) el.textContent = selectedLabel(ligSelectedTeeth[arch].fig8);
    }, archTeeth);
  }
}

function updateLigSelectedLabel(arch) {
  // kept for compatibility but now handled per-type above
}

function toggleLigChart(arch) {
  const shortEl  = document.getElementById(`fuf-lig-${arch}-short`);
  const fig8El   = document.getElementById(`fuf-lig-${arch}-fig8`);
  const chartWrap= document.getElementById(`fuf-lig-chart-${arch}`);
  const shortChart = document.getElementById(`fuf-lig-chart-${arch}-short-wrap`);
  const fig8Chart  = document.getElementById(`fuf-lig-chart-${arch}-fig8-wrap`);
  if (!chartWrap) return;
  const shortOn = shortEl?.checked;
  const fig8On  = fig8El?.checked;
  chartWrap.style.display   = (shortOn || fig8On) ? '' : 'none';
  if (shortChart) shortChart.style.display = shortOn ? '' : 'none';
  if (fig8Chart)  fig8Chart.style.display  = fig8On  ? '' : 'none';
  if (shortOn || fig8On) buildLigMiniChart(arch);
}


// ── Extraction chart toggle (Treatment Plan tab) ───────────────────────
function toggleExtChart() {
  const val  = document.querySelector('[name="plan-ext"]:checked')?.value || '';
  const wrap = document.getElementById('plan-ext-chart-wrap');
  if (!wrap) return;

  if (val === 'Other') {
    wrap.style.display = '';
    // بناء الـ chart إذا لم يكن مبنياً بعد
    const upperRow = document.getElementById('plan-ext-chart-upper');
    const lowerRow = document.getElementById('plan-ext-chart-lower');
    if (upperRow && !upperRow.children.length) {
      buildExtRow(upperRow, upperTeeth);
    }
    if (lowerRow && !lowerRow.children.length) {
      buildExtRow(lowerRow, lowerTeeth);
    }
  } else {
    wrap.style.display = 'none';
  }
}

function buildExtRow(rowEl, teeth) {
  rowEl.innerHTML = '';
  teeth.forEach((num, i) => {
    if (i === 8) {
      const sp = document.createElement('div');
      sp.style.cssText = 'width:4px;border-left:2px dashed var(--gold);margin:0 1px;';
      rowEl.appendChild(sp);
    }
    const btn = document.createElement('div');
    btn.className = 'mini-tooth' + (extChartSet.has(num) ? ' selected' : '');
    btn.textContent = toothLabel(num);
    btn.dataset.fdi = num;
    btn.onclick = () => {
      const n = parseInt(btn.dataset.fdi);
      if (extChartSet.has(n)) extChartSet.delete(n);
      else extChartSet.add(n);
      btn.classList.toggle('selected');
      const lbl = document.getElementById('plan-ext-chart-selected');
      if (lbl) {
        const sorted = [...extChartSet].sort((a,b) => a - b).map(n => toothLabel(n));
        lbl.textContent = sorted.length ? sorted.join(', ') : '—';
      }
    };
    rowEl.appendChild(btn);
  });
}

// ── Elastic config asymmetric toggle ──────────────────────────────────
function toggleElasticConfig(prefix) {
  const val    = document.querySelector(`[name="${prefix}-elastic-config"]:checked`)?.value;
  const symEl  = document.getElementById(`${prefix}-elastic-sym`);
  const asymEl = document.getElementById(`${prefix}-elastic-asym`);
  if (symEl)  symEl.style.display  = val === 'asymmetric' ? 'none' : '';
  if (asymEl) asymEl.style.display = val === 'asymmetric' ? ''     : 'none';
}

// ══════════════════════════════════════════════════════════════
// MULTI-TAD STATUS — follow-up tabs (fuf / fua)
// Each TAD gets its own collapsible card with full status fields
// ══════════════════════════════════════════════════════════════
const fuTadState = {
  fuf: [], // array of { stability, loading, tissue, progress, notes, label }
  fua: [],
};
const FU_TAD_COLORS = ['#1a7a7a','#c9a84c','#a02820','#6a1f9e','#1a5c3a','#0d3b6e'];

function toggleTadStatus(prefix) {
  const chk  = document.getElementById(prefix + '-has-tad');
  const wrap = document.getElementById(prefix + '-tad-status-wrap');
  if (!chk || !wrap) return;
  if (chk.checked) {
    wrap.style.display = '';
    // init with one TAD if empty
    if (fuTadState[prefix].length === 0) fuTadAddScrew(prefix);
    else fuTadRender(prefix);
  } else {
    wrap.style.display = 'none';
  }
}

function fuTadAddScrew(prefix) {
  const idx = fuTadState[prefix].length;
  fuTadState[prefix].push({
    label: 'TAD #' + (idx + 1),
    stability: '', loading: '', tissue: '', progress: '', notes: ''
  });
  fuTadRender(prefix);
}

function fuTadRemoveScrew(prefix, idx) {
  if (fuTadState[prefix].length === 1) { showToast('⚠️ At least one TAD required', 'error'); return; }
  fuTadState[prefix].splice(idx, 1);
  fuTadState[prefix].forEach((s, i) => s.label = 'TAD #' + (i + 1));
  fuTadRender(prefix);
}

function fuTadRender(prefix) {
  const container = document.getElementById(prefix + '-tad-cards');
  if (!container) return;
  container.innerHTML = '';

  fuTadState[prefix].forEach((sc, idx) => {
    const color = FU_TAD_COLORS[idx % FU_TAD_COLORS.length];
    const p = prefix; // closure

    const card = document.createElement('div');
    card.style.cssText = `background:var(--grey-50);border:1.5px solid ${color};border-radius:9px;padding:12px 14px;display:grid;gap:9px;margin-bottom:8px;`;

    // Card header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:8px;';
    hdr.innerHTML = `
      <div style="width:22px;height:22px;border-radius:5px;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${idx+1}</div>
      <input type="text" value="${sc.label}"
        style="flex:1;border:1.5px solid var(--grey-200);border-radius:6px;padding:3px 8px;font-size:0.8rem;font-family:'DM Sans',sans-serif;outline:none;"
        oninput="fuTadState['${p}'][${idx}].label=this.value;">
      <button onclick="fuTadRemoveScrew('${p}',${idx})"
        style="background:transparent;border:none;color:var(--grey-400);cursor:pointer;font-size:14px;padding:2px 4px;"
        title="Remove">✕</button>`;
    card.appendChild(hdr);

    // Fields
    const grid = document.createElement('div');
    grid.className = 'grid-2';

    const radioField = (labelTxt, name, options, curVal) => {
      const d = document.createElement('div');
      d.className = 'field';
      d.innerHTML = `<label>${labelTxt}</label>`;
      const tg = document.createElement('div');
      tg.className = 'toggle-group';
      options.forEach(([val, lbl]) => {
        const l = document.createElement('label');
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = `${p}-tad-${name}-${idx}`; inp.value = val;
        if (val === curVal) inp.checked = true;
        inp.onchange = () => { fuTadState[p][idx][name] = val; };
        const sp = document.createElement('span');
        sp.textContent = lbl;
        l.appendChild(inp); l.appendChild(sp);
        tg.appendChild(l);
      });
      d.appendChild(tg);
      return d;
    };

    grid.appendChild(radioField('TAD Stability', 'stability', [
      ['Stable — no mobility',       '✅ Stable'],
      ['Slightly mobile — monitor',  '⚠️ Slightly mobile'],
      ['Mobile — needs removal',     '❌ Mobile'],
    ], sc.stability));

    grid.appendChild(radioField('Loading Status', 'loading', [
      ['Active — force applied',       '✅ Active'],
      ['Passive — resting',            '🔵 Passive'],
      ['Force modified this visit',    '🔄 Modified'],
      ['Removed this visit',           '✂️ Removed'],
    ], sc.loading));

    card.appendChild(grid);

    const grid2 = document.createElement('div');
    grid2.className = 'grid-2';

    grid2.appendChild(radioField('Peri-implant Tissue', 'tissue', [
      ['Healthy — no inflammation',              '✅ Healthy'],
      ['Mild inflammation — OH reinforced',      '⚠️ Mild — OH reinforced'],
      ['Moderate — chlorhexidine prescribed',    '🔴 Moderate — CHX'],
      ['Hyperplastic — surgical review',         '❌ Hyperplastic'],
    ], sc.tissue));

    grid2.appendChild(radioField('Mechanical Progress', 'progress', [
      ['On track — objective progressing',          '✅ On track'],
      ['Slower than expected — monitor',            '⚠️ Slower than expected'],
      ['Objective achieved — TAD to be removed',   '🏁 Objective achieved'],
      ['Failed — re-insertion planned',             '❌ Failed — re-insertion planned'],
    ], sc.progress));

    card.appendChild(grid2);

    // Notes
    const notesD = document.createElement('div');
    notesD.className = 'field';
    notesD.innerHTML = '<label>Notes</label>';
    const notesInp = document.createElement('input');
    notesInp.type = 'text';
    notesInp.value = sc.notes || '';
    notesInp.placeholder = 'Force magnitude, attachment point changes, patient feedback...';
    notesInp.oninput = () => { fuTadState[p][idx].notes = notesInp.value; };
    notesD.appendChild(notesInp);
    card.appendChild(notesD);

    container.appendChild(card);
  });
}

// Collect multi-TAD data for summary
function fuTadSummaryLines(prefix) {
  const lines = [];
  fuTadState[prefix].forEach((sc, i) => {
    const parts = [sc.stability, sc.loading, sc.tissue, sc.progress].filter(Boolean);
    if (parts.length || sc.notes) {
      lines.push(`  ${sc.label}: ${parts.join(' · ')}${sc.notes ? ' — ' + sc.notes : ''}`);
    }
  });
  return lines;
}


// ── Admin schema integration ───────────────────────────────────────────
function applyAdminSchema() {
  const saved = localStorage.getItem('ortho_admin_schema');
  if (!saved) return;
  try {
    const schema = JSON.parse(saved);

    // Apply wire sizes & materials
    if (schema.wireSizes) WIRE_SIZES.length = 0, schema.wireSizes.forEach(s => WIRE_SIZES.push(s));
    if (schema.wireMats)  WIRE_MATS.length  = 0, schema.wireMats.forEach(m => WIRE_MATS.push(m));

    // Rebuild wire selectors with new options
    // ref-wire-selector is rebuilt lazily — only if it already has children (tab was visited)
    ['bond-wire-selector','fuf-wire-selector','em-wire-selector'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.innerHTML = ''; delete wireState[id]; buildWireSelector(id); }
    });
    // Rebuild ref-wire-selector only if already built (tab was visited at least once)
    const refWs = document.getElementById('ref-wire-selector');
    if (refWs && refWs.children.length) {
      refWs.innerHTML = ''; delete wireState['ref-wire-selector']; buildWireSelector('ref-wire-selector');
    }

    // Apply field options to toggle groups
    if (schema.fields) {
      Object.values(schema.fields).forEach(fields => {
        fields.forEach(field => {
          if (!field.options || !field.id) return;

          // Handle emergency pills
          if (field.id === 'em-pills') {
            const pillsContainer = document.getElementById('em-type-pills');
            if (pillsContainer) {
              pillsContainer.innerHTML = '';
              field.options.forEach(opt => {
                const pill = document.createElement('div');
                pill.className = 'emergency-pill';
                pill.dataset.val = opt;
                pill.textContent = opt;
                pill.onclick = () => toggleEmPill(pill);
                pillsContainer.appendChild(pill);
              });
            }
            return;
          }

          // Handle radio groups
          // plan-ext مُدار يدوياً — لا نسمح للـ schema بالكتابة فوقه
          if (field.id === 'plan-ext') return;

          document.querySelectorAll(`[name="${field.id}"]`).forEach(el => {
            const group = el.closest('.toggle-group');
            if (!group) return;
            const type = el.type; // radio or checkbox
            group.innerHTML = '';
            field.options.forEach(opt => {
              const lbl = document.createElement('label');
              const inp = document.createElement('input');
              inp.type  = type;
              inp.name  = field.id;
              inp.value = opt;
              const span = document.createElement('span');
              span.textContent = opt;
              lbl.appendChild(inp);
              lbl.appendChild(span);
              group.appendChild(lbl);
            });
          });

          // Handle select dropdowns
          document.querySelectorAll(`#${field.id}`).forEach(el => {
            if (el.tagName !== 'SELECT') return;
            const cur = el.value;
            el.innerHTML = '<option value="">— Select —</option>';
            field.options.forEach(opt => {
              const o = document.createElement('option');
              o.value = opt; o.textContent = opt;
              el.appendChild(o);
            });
            el.value = cur; // restore if still valid
          });
        });
      });
    }

    // Apply notation system
    // FIX: prefer the dedicated ortho_notation key (always most up-to-date)
    // over schema.notation (which may be from an older save)
    const currentNotation = localStorage.getItem('ortho_notation') || schema.notation;
    if (currentNotation) { setNotation(currentNotation); }

    // Apply clinic name to header if provided
    if (schema.clinicName) {
      const sub = document.getElementById('clinic-name-display');
      if (sub) sub.textContent = schema.clinicName;
    }

  } catch(e) { console.warn('Admin schema apply error:', e); }
}

// ══════════════════════════════════════════════════════════════
// TAD / MINI-SCREW — MULTI-SCREW SYSTEM
// ══════════════════════════════════════════════════════════════

let tadScrews = [];
let tadActiveScrewIdx = -1;
const TAD_COLORS = ['#1a7a7a','#c9a84c','#a02820','#6a1f9e','#1a5c3a','#0d3b6e'];

function tadAddScrew() {
  const idx = tadScrews.length;
  tadScrews.push({
    id:'screw_'+Date.now()+'_'+idx, label:'Screw #'+(idx+1),
    jaw:'', maxSite:'', mandSite:'',
    maxSide:'', mandSide:'', mandOtherSide:'',
    izcSide:'', izcVert:'', palatalAP:'', siteNotes:'',
    maxTeeth:[], mandTeeth:[],
    diameter:'', length:'', head:'', brand:'', purposes:[],
    anaes:'', pilot:'', torque:'', stability:'', angle:'', xray:'', procNotes:'',
    loadingTime:'', forceType:'', forceMag:'', forceDir:'', loadingNotes:'',
    status:'', tissue:'',
  });
  tadRenderTabs();
  tadSwitchScrew(idx);
}

function tadRemoveScrew(idx) {
  if (tadScrews.length === 1) { showToast('⚠️ At least one screw is required','error'); return; }
  if (!confirm('Remove '+tadScrews[idx].label+'?')) return;
  tadScrews.splice(idx,1);
  tadScrews.forEach((s,i) => s.label='Screw #'+(i+1));
  const newIdx = Math.min(idx, tadScrews.length-1);
  tadRenderTabs();
  tadSwitchScrew(newIdx);
}

function tadRenderTabs() {
  const bar = document.getElementById('tad-screw-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  tadScrews.forEach((sc,i) => {
    const color = TAD_COLORS[i % TAD_COLORS.length];
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.style.cssText = `background:${i===tadActiveScrewIdx?color:'rgba(255,255,255,0.08)'};color:${i===tadActiveScrewIdx?'white':'rgba(255,255,255,0.6)'};border:1.5px solid ${color};border-radius:8px;transition:all .2s;font-size:0.76rem;gap:6px;`;
    btn.innerHTML = sc.label+` <span style="opacity:.55;font-size:.65rem;" onclick="event.stopPropagation();tadRemoveScrew(${i})">✕</span>`;
    btn.onclick = () => tadSwitchScrew(i);
    bar.appendChild(btn);
  });
}

function tadSwitchScrew(idx) {
  if (tadActiveScrewIdx >= 0 && tadScrews[tadActiveScrewIdx]) tadCollectScrew(tadActiveScrewIdx);
  tadActiveScrewIdx = idx;
  tadRenderTabs();
  tadRenderScrewCard(idx);
}

function tadRenderScrewCard(idx) {
  const container = document.getElementById('tad-screws-container');
  if (!container) return;
  const sc = tadScrews[idx];
  const color = TAD_COLORS[idx % TAD_COLORS.length];
  const fid = f => `tad_${idx}_${f}`;
  const fn  = f => `tad_${idx}_${f}`;
  const v   = f => (sc[f]||'');

  const radioOpts = (name, opts, cur) => opts.map(([val,lbl])=>
    `<label><input type="radio" name="${fn(name)}" value="${val}" ${cur===val?'checked':''}><span>${lbl}</span></label>`
  ).join('');

  container.innerHTML = `
  <div class="section-card" style="border-top:3px solid ${color};">
    <div style="display:flex;align-items:center;gap:10px;padding:11px 15px;background:var(--grey-50);border-bottom:1px solid var(--grey-200);">
      <div style="width:27px;height:27px;border-radius:7px;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">${idx+1}</div>
      <span style="font-family:'DM Serif Display',serif;font-size:0.95rem;color:var(--navy);flex:1;">${sc.label}</span>
      <input type="text" id="${fid('label')}" value="${sc.label}" placeholder="Label (e.g. Upper Right Buccal)"
        style="border:1.5px solid var(--grey-200);border-radius:7px;padding:4px 9px;font-size:0.8rem;font-family:'DM Sans',sans-serif;outline:none;width:220px;"
        oninput="tadScrews[${idx}].label=this.value;tadRenderTabs();">
    </div>
    <div style="padding:14px 15px;display:grid;gap:11px;">

      <div class="sub-title" style="color:${color};">📍 Site of Insertion</div>
      <div class="field"><label>Jaw</label>
        <div class="toggle-group">
          <label><input type="radio" name="${fn('jaw')}" value="Maxilla" ${sc.jaw==='Maxilla'?'checked':''} onchange="tadJawChange(${idx},this.value)"><span>⬆️ Maxilla</span></label>
          <label><input type="radio" name="${fn('jaw')}" value="Mandible" ${sc.jaw==='Mandible'?'checked':''} onchange="tadJawChange(${idx},this.value)"><span>⬇️ Mandible</span></label>
        </div>
      </div>

      <!-- Maxilla -->
      <div id="${fid('max-wrap')}" style="display:${sc.jaw==='Maxilla'?'grid':'none'};gap:9px;">
        <div class="field"><label>Maxillary Site</label>
          <div class="toggle-group">
            ${['Alveolar Buccal','Alveolar Palatal','Mid-palatal suture','Para-median palatal','Infra-zygomatic crest (IZC)'].map(s=>
              `<label><input type="radio" name="${fn('maxSite')}" value="${s}" ${sc.maxSite===s?'checked':''} onchange="tadMaxSiteChange(${idx},this.value)"><span>${s}</span></label>`
            ).join('')}
          </div>
        </div>
        <div id="${fid('max-teeth-wrap')}" style="display:${(sc.maxSite==='Alveolar Buccal'||sc.maxSite==='Alveolar Palatal')?'block':'none'};">
          <div style="background:var(--grey-50);border:1.5px solid var(--teal-mid);border-radius:9px;padding:11px 13px;">
            <div class="sub-title" style="margin-bottom:8px;">Between Which Teeth — Upper</div>
            <div id="${fid('max-tooth-row')}"></div>
            <div style="font-size:0.74rem;color:var(--grey-500);margin-top:6px;">Selected: <span id="${fid('max-tooth-sel')}" style="font-weight:700;color:var(--teal);">${sc.maxTeeth.length?sc.maxTeeth.map(n=>toothLabel(n)).join(' & '):'—'}</span></div>
            <div class="field" style="margin-top:8px;"><label>Side</label>
              <div class="toggle-group">${radioOpts('maxSide',[['Right','Right'],['Left','Left'],['Bilateral','Bilateral']],sc.maxSide)}</div>
            </div>
          </div>
        </div>
        <div id="${fid('izc-wrap')}" style="display:${sc.maxSite==='Infra-zygomatic crest (IZC)'?'block':'none'};">
          <div style="background:var(--grey-50);border:1.5px solid var(--teal-mid);border-radius:9px;padding:11px 13px;">
            <div class="field"><label>IZC Side</label>
              <div class="toggle-group">${radioOpts('izcSide',[['Right IZC','Right'],['Left IZC','Left'],['Bilateral IZC','Bilateral']],sc.izcSide)}</div>
            </div>
            <div class="field" style="margin-top:8px;"><label>Vertical Position</label>
              <div class="toggle-group">${radioOpts('izcVert',[['High (above mucogingival junction)','High'],['Low (near mucogingival junction)','Low']],sc.izcVert)}</div>
            </div>
          </div>
        </div>
        <div id="${fid('palatal-wrap')}" style="display:${(sc.maxSite==='Mid-palatal suture'||sc.maxSite==='Para-median palatal')?'block':'none'};">
          <div style="background:var(--grey-50);border:1.5px solid var(--teal-mid);border-radius:9px;padding:11px 13px;">
            <div class="field"><label>Palatal Position (A-P)</label>
              <div class="toggle-group">${radioOpts('palatalAP',[['Anterior palate (3-5mm from incisive foramen)','Anterior'],['Middle palate','Middle'],['Posterior palate','Posterior']],sc.palatalAP)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mandible -->
      <div id="${fid('mand-wrap')}" style="display:${sc.jaw==='Mandible'?'grid':'none'};gap:9px;">
        <div class="field"><label>Mandibular Site</label>
          <div class="toggle-group">
            ${['Buccal Alveolar','Mandibular Buccal Shelf (MBS)','Retromolar area'].map(s=>
              `<label><input type="radio" name="${fn('mandSite')}" value="${s}" ${sc.mandSite===s?'checked':''} onchange="tadMandSiteChange(${idx},this.value)"><span>${s}</span></label>`
            ).join('')}
          </div>
        </div>
        <div id="${fid('mand-teeth-wrap')}" style="display:${sc.mandSite==='Buccal Alveolar'?'block':'none'};">
          <div style="background:var(--grey-50);border:1.5px solid var(--teal-mid);border-radius:9px;padding:11px 13px;">
            <div class="sub-title" style="margin-bottom:8px;">Between Which Teeth — Lower</div>
            <div id="${fid('mand-tooth-row')}"></div>
            <div style="font-size:0.74rem;color:var(--grey-500);margin-top:6px;">Selected: <span id="${fid('mand-tooth-sel')}" style="font-weight:700;color:var(--teal);">${sc.mandTeeth.length?sc.mandTeeth.map(n=>toothLabel(n)).join(' & '):'—'}</span></div>
            <div class="field" style="margin-top:8px;"><label>Side</label>
              <div class="toggle-group">${radioOpts('mandSide',[['Right','Right'],['Left','Left'],['Bilateral','Bilateral']],sc.mandSide)}</div>
            </div>
          </div>
        </div>
        <div id="${fid('mand-other-wrap')}" style="display:${(sc.mandSite==='Mandibular Buccal Shelf (MBS)'||sc.mandSite==='Retromolar area')?'block':'none'};">
          <div style="background:var(--grey-50);border:1.5px solid var(--teal-mid);border-radius:9px;padding:11px 13px;">
            <div class="field"><label>Side</label>
              <div class="toggle-group">${radioOpts('mandOtherSide',[['Right','Right'],['Left','Left'],['Bilateral','Bilateral']],sc.mandOtherSide)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="field"><label>Site Notes</label>
        <input type="text" id="${fid('siteNotes')}" value="${v('siteNotes')}" placeholder="Angulation, depth, additional details...">
      </div>

      <!-- SPECS -->
      <div class="sub-title" style="color:${color};margin-top:4px;">🔬 Screw Specifications</div>
      <div class="grid-3">
        <div class="field"><label>Diameter</label><div class="toggle-group">${radioOpts('diameter',[['1.4 mm','1.4 mm'],['1.6 mm','1.6 mm'],['1.8 mm','1.8 mm'],['2.0 mm','2.0 mm']],sc.diameter)}</div></div>
        <div class="field"><label>Length</label><div class="toggle-group">${radioOpts('length',[['6 mm','6 mm'],['8 mm','8 mm'],['10 mm','10 mm'],['12 mm','12 mm'],['14 mm','14 mm']],sc.length)}</div></div>
        <div class="field"><label>Head Type</label><div class="toggle-group">${radioOpts('head',[['Bracket-like head','Bracket-like'],['Button head','Button'],['Cross-slot head','Cross-slot']],sc.head)}</div></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Brand</label><div class="toggle-group">${radioOpts('brand',[['AbsoAnchor','AbsoAnchor'],['Infinitas','Infinitas'],['TOMAS','TOMAS'],['Orthoimplant','Orthoimplant'],['Other','Other']],sc.brand)}</div></div>
        <div class="field"><label>Purpose</label><div class="toggle-group">
          ${[['anch','Anchorage'],['intr','Intrusion'],['dist','Distalization'],['retr','En-masse retraction'],['molar','Molar uprighting'],['midline','Midline correction'],['other','Other']].map(([k,l])=>
            `<label><input type="checkbox" id="${fid('p_'+k)}" ${sc.purposes.includes(k)?'checked':''}><span>${l}</span></label>`
          ).join('')}
        </div></div>
      </div>

      <!-- PROCEDURE -->
      <div class="sub-title" style="color:${color};margin-top:4px;">💉 Clinical Procedure</div>
      <div class="grid-2">
        <div class="field"><label>Anaesthesia</label><div class="toggle-group">
          ${radioOpts('anaes',[
            ['Infiltration — Lidocaine 2% with Epinephrine 1:80,000','Lidocaine 2% + Epi 1:80k'],
            ['Infiltration — Articaine 4% with Epinephrine 1:100,000','Articaine 4% + Epi 1:100k'],
            ['Infiltration — Mepivacaine 3% (no vasoconstrictor)','Mepivacaine 3%'],
            ['Topical anaesthesia only','Topical only'],
            ['Palatal injection — Greater palatine block','Greater palatine block'],
            ['IANB — Inferior alveolar nerve block','IANB']
          ],sc.anaes)}
        </div></div>
        <div class="field"><label>Pilot Hole</label><div class="toggle-group">
          ${radioOpts('pilot',[['No pilot hole — freehand insertion','No pilot hole'],['Pilot hole drilled — slow-speed handpiece','Pilot hole drilled'],['Tissue punch used','Tissue punch']],sc.pilot)}
        </div></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Insertion Torque</label>
          <div class="toggle-group">${radioOpts('torque',[['Low torque — smooth insertion','🟢 Low — smooth'],['Moderate torque — slight resistance','🟡 Moderate'],['High torque — significant resistance','🔴 High']],sc.torque)}</div>
          <div style="background:var(--teal-light);border:1px solid var(--teal-mid);border-radius:7px;padding:7px 10px;font-size:0.74rem;color:var(--teal);margin-top:6px;">💡 High torque → better stability but higher bone stress.</div>
        </div>
        <div class="field"><label>Primary Stability</label><div class="toggle-group">
          ${radioOpts('stability',[['Stable — no mobility','✅ Stable'],['Slightly mobile — monitor','⚠️ Slightly mobile'],['Mobile — repositioned','❌ Repositioned'],['Mobile — removed','❌ Removed']],sc.stability)}
        </div></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Insertion Angle</label><div class="toggle-group">
          ${radioOpts('angle',[['30–40° (recommended alveolar)','30–40° (alveolar)'],['60–70° (recommended palatal)','60–70° (palatal)'],['70–80° (IZC / MBS)','70–80° (IZC/MBS)'],['90° (perpendicular)','90°']],sc.angle)}
        </div></div>
        <div class="field"><label>Post-insertion X-ray</label><div class="toggle-group">
          ${radioOpts('xray',[['Taken — clear of root structures','✅ Clear of roots'],['Taken — proximity to root noted, acceptable','⚠️ Proximity — acceptable'],['Taken — repositioned due to root proximity','❌ Repositioned'],['Not taken at this visit','Not taken']],sc.xray)}
        </div></div>
      </div>
      <div class="field"><label>Procedure Notes</label>
        <textarea id="${fid('procNotes')}" placeholder="Complications, patient reaction, tissue condition...">${v('procNotes')}</textarea>
      </div>

      <!-- LOADING -->
      <div class="sub-title" style="color:${color};margin-top:4px;">⚡ Loading Protocol</div>
      <div class="grid-2">
        <div class="field"><label>Loading Timing</label><div class="toggle-group">
          ${radioOpts('loadingTime',[['Immediate loading — same visit','Immediate — same visit'],['Delayed loading — 2 weeks','Delayed — 2 weeks'],['Delayed loading — 4 weeks','Delayed — 4 weeks'],['Not loaded yet — passive only','Passive only']],sc.loadingTime)}
        </div></div>
        <div class="field"><label>Force Delivery Type</label><div class="toggle-group">
          ${radioOpts('forceType',[['Power chain','Power chain'],['NiTi closed coil spring','NiTi coil spring'],['Ligature wire (0.010″)','Ligature wire'],['Stainless steel chain','SS chain'],['Elastic thread','Elastic thread'],['TMA cantilever','TMA cantilever']],sc.forceType)}
        </div></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Force Magnitude</label><div class="toggle-group">
          ${radioOpts('forceMag',[['50–100 g','50–100 g'],['100–150 g','100–150 g'],['150–200 g','150–200 g'],['200–250 g','200–250 g'],['250–300 g','250–300 g'],['>300 g','>300 g']],sc.forceMag)}
        </div></div>
        <div class="field"><label>Force Direction</label><div class="toggle-group">
          ${radioOpts('forceDir',[['Intrusive','Intrusive'],['Retractive','Retractive'],['Distalizing','Distalizing'],['Mesialization','Mesialization'],['Extrusive','Extrusive'],['Multi-directional','Multi-directional']],sc.forceDir)}
        </div></div>
      </div>
      <div class="field"><label>Loading Notes</label>
        <textarea id="${fid('loadingNotes')}" placeholder="Mechanics, attachment points, force vectors...">${v('loadingNotes')}</textarea>
      </div>

    </div>
  </div>`;

  // Build mini tooth charts if needed
  if (sc.maxSite === 'Alveolar Buccal' || sc.maxSite === 'Alveolar Palatal') {
    const set = new Set(sc.maxTeeth);
    buildMiniChart(fid('max-tooth-row'), set, () => {
      sc.maxTeeth = [...set];
      const lbl = document.getElementById(fid('max-tooth-sel'));
      if (lbl) lbl.textContent = sc.maxTeeth.length ? sc.maxTeeth.map(n=>toothLabel(n)).join(' & ') : '—';
    }, upperTeeth);
  }
  if (sc.mandSite === 'Buccal Alveolar') {
    const set = new Set(sc.mandTeeth);
    buildMiniChart(fid('mand-tooth-row'), set, () => {
      sc.mandTeeth = [...set];
      const lbl = document.getElementById(fid('mand-tooth-sel'));
      if (lbl) lbl.textContent = sc.mandTeeth.length ? sc.mandTeeth.map(n=>toothLabel(n)).join(' & ') : '—';
    }, lowerTeeth);
  }
}

function tadJawChange(idx, val) {
  tadScrews[idx].jaw = val;
  const fid = f => `tad_${idx}_${f}`;
  const mxW = document.getElementById(fid('max-wrap'));
  const mnW = document.getElementById(fid('mand-wrap'));
  if (mxW) mxW.style.display = val==='Maxilla'  ? 'grid' : 'none';
  if (mnW) mnW.style.display = val==='Mandible' ? 'grid' : 'none';
}

function tadMaxSiteChange(idx, val) {
  tadScrews[idx].maxSite = val;
  const fid = f => `tad_${idx}_${f}`;
  const isAlv = val==='Alveolar Buccal'||val==='Alveolar Palatal';
  const isIZC = val==='Infra-zygomatic crest (IZC)';
  const isPal = val==='Mid-palatal suture'||val==='Para-median palatal';
  document.getElementById(fid('max-teeth-wrap')).style.display = isAlv ? 'block':'none';
  document.getElementById(fid('izc-wrap')).style.display       = isIZC ? 'block':'none';
  document.getElementById(fid('palatal-wrap')).style.display   = isPal ? 'block':'none';
  if (isAlv && !document.getElementById(fid('max-tooth-row')).children.length) {
    const set = new Set(tadScrews[idx].maxTeeth);
    buildMiniChart(fid('max-tooth-row'), set, () => {
      tadScrews[idx].maxTeeth = [...set];
      const lbl = document.getElementById(fid('max-tooth-sel'));
      if (lbl) lbl.textContent = tadScrews[idx].maxTeeth.length ? tadScrews[idx].maxTeeth.map(n=>toothLabel(n)).join(' & ') : '—';
    }, upperTeeth);
  }
}

function tadMandSiteChange(idx, val) {
  tadScrews[idx].mandSite = val;
  const fid = f => `tad_${idx}_${f}`;
  const isBuc = val==='Buccal Alveolar';
  document.getElementById(fid('mand-teeth-wrap')).style.display = isBuc  ? 'block':'none';
  document.getElementById(fid('mand-other-wrap')).style.display = !isBuc ? 'block':'none';
  if (isBuc && !document.getElementById(fid('mand-tooth-row')).children.length) {
    const set = new Set(tadScrews[idx].mandTeeth);
    buildMiniChart(fid('mand-tooth-row'), set, () => {
      tadScrews[idx].mandTeeth = [...set];
      const lbl = document.getElementById(fid('mand-tooth-sel'));
      if (lbl) lbl.textContent = tadScrews[idx].mandTeeth.length ? tadScrews[idx].mandTeeth.map(n=>toothLabel(n)).join(' & ') : '—';
    }, lowerTeeth);
  }
}

function tadCollectScrew(idx) {
  const sc = tadScrews[idx];
  if (!sc) return;
  const container = document.getElementById('tad-screws-container');
  if (!container) return;
  const fid = f => `tad_${idx}_${f}`;
  const fn  = f => `tad_${idx}_${f}`;
  const rv  = name => { const el = container.querySelector(`[name="${name}"]:checked`); return el?el.value:''; };
  sc.label          = document.getElementById(fid('label'))?.value || sc.label;
  sc.jaw            = rv(fn('jaw'));
  sc.maxSite        = rv(fn('maxSite'));
  sc.mandSite       = rv(fn('mandSite'));
  sc.maxSide        = rv(fn('maxSide'));
  sc.mandSide       = rv(fn('mandSide'));
  sc.mandOtherSide  = rv(fn('mandOtherSide'));
  sc.izcSide        = rv(fn('izcSide'));
  sc.izcVert        = rv(fn('izcVert'));
  sc.palatalAP      = rv(fn('palatalAP'));
  sc.siteNotes      = document.getElementById(fid('siteNotes'))?.value||'';
  sc.diameter       = rv(fn('diameter'));
  sc.length         = rv(fn('length'));
  sc.head           = rv(fn('head'));
  sc.brand          = rv(fn('brand'));
  sc.purposes       = ['anch','intr','dist','retr','molar','midline','other'].filter(k=>document.getElementById(fid('p_'+k))?.checked);
  sc.anaes          = rv(fn('anaes'));
  sc.pilot          = rv(fn('pilot'));
  sc.torque         = rv(fn('torque'));
  sc.stability      = rv(fn('stability'));
  sc.angle          = rv(fn('angle'));
  sc.xray           = rv(fn('xray'));
  sc.procNotes      = document.getElementById(fid('procNotes'))?.value||'';
  sc.loadingTime    = rv(fn('loadingTime'));
  sc.forceType      = rv(fn('forceType'));
  sc.forceMag       = rv(fn('forceMag'));
  sc.forceDir       = rv(fn('forceDir'));
  sc.loadingNotes   = document.getElementById(fid('loadingNotes'))?.value||'';
}

// ══════════════════════════════════════════════════════════════
// REFERRED PATIENT — helper functions
// ══════════════════════════════════════════════════════════════

// Extraction chart for referred tab
const refExtChartSet = new Set();

function toggleRefExtChart() {
  const val  = document.querySelector('[name="ref-prev-ext"]:checked')?.value || '';
  const wrap = document.getElementById('ref-ext-chart-wrap');
  if (!wrap) return;
  if (val === 'Other') {
    wrap.style.display = '';
    const upperRow = document.getElementById('ref-ext-chart-upper');
    const lowerRow = document.getElementById('ref-ext-chart-lower');
    if (upperRow && !upperRow.children.length) buildRefExtRow(upperRow, upperTeeth);
    if (lowerRow && !lowerRow.children.length) buildRefExtRow(lowerRow, lowerTeeth);
  } else {
    wrap.style.display = 'none';
  }
}

function buildRefExtRow(rowEl, teeth) {
  rowEl.innerHTML = '';
  teeth.forEach((num, i) => {
    if (i === 8) {
      const sp = document.createElement('div');
      sp.style.cssText = 'width:4px;border-left:2px dashed var(--gold);margin:0 1px;flex-shrink:0;';
      rowEl.appendChild(sp);
    }
    const btn = document.createElement('div');
    btn.className = 'mini-tooth' + (refExtChartSet.has(num) ? ' selected' : '');
    btn.textContent = toothLabel(num);
    btn.dataset.fdi = num;
    btn.onclick = () => {
      const n = parseInt(btn.dataset.fdi);
      if (refExtChartSet.has(n)) refExtChartSet.delete(n);
      else refExtChartSet.add(n);
      btn.classList.toggle('selected');
      const lbl = document.getElementById('ref-ext-chart-selected');
      if (lbl) {
        const sorted = [...refExtChartSet].sort((a,b)=>a-b).map(n=>toothLabel(n));
        lbl.textContent = sorted.length ? sorted.join(', ') : '—';
      }
    };
    rowEl.appendChild(btn);
  });
}

function updateRefDecision() {
  const val = document.querySelector('[name="ref-decision"]:checked')?.value || '';
  const detail = document.getElementById('ref-decision-detail');
  if (!detail) return;
  const showDetail = val && val !== 'Continue treatment — original plan appropriate';
  detail.style.display = showDetail ? '' : 'none';
}

// ══════════════════════════════════════════════════════════════
// RETENTION FOLLOW-UP — helper functions
// ══════════════════════════════════════════════════════════════

const retChartSets = {
  upper: new Set(),
  lower: new Set(),
};

function toggleRetChart(arch) {
  const integrityVal = document.querySelector(`[name="ret-fr-${arch}-integrity"]:checked`)?.value || '';
  const wrap = document.getElementById(`ret-chart-${arch}-wrap`);
  if (!wrap) return;
  const needsChart = integrityVal === 'Partial debond'
    || integrityVal === 'Complete debond — retainer detached'
    || integrityVal === 'Wire fracture'
    || integrityVal === 'Wire distortion noted';
  wrap.style.display = needsChart ? '' : 'none';
  if (needsChart) {
    const rowEl = document.getElementById(`ret-chart-${arch}-row`);
    if (rowEl && !rowEl.children.length) {
      const teeth = arch === 'upper' ? upperTeeth : lowerTeeth;
      buildMiniChart(`ret-chart-${arch}-row`, retChartSets[arch], () => {
        const lbl = document.getElementById(`ret-chart-${arch}-selected`);
        if (lbl) lbl.textContent = selectedLabel(retChartSets[arch]);
      }, teeth);
    }
  }
}

function updateRetDecision() {
  const val = document.querySelector('[name="ret-decision"]:checked')?.value || '';
  const dischargeWrap = document.getElementById('ret-discharge-wrap');
  if (!dischargeWrap) return;
  dischargeWrap.style.display = val.startsWith('Discharge') ? '' : 'none';
}

window.addEventListener('storage', e => {
  // FIX: handle ortho_notation FIRST to ensure it's set before applyAdminSchema reads it
  if (e.key === 'ortho_notation' && e.newValue) {
    setNotation(e.newValue);
  }
  // When full schema is saved/updated, reapply everything
  // applyAdminSchema now reads ortho_notation (not schema.notation) so it won't override
  if (e.key === 'ortho_admin_update') applyAdminSchema();
});

// ══════════════════════════════════════════════════════════════
// AUTO-SAVE & UNSAVED CHANGES TRACKING
// ══════════════════════════════════════════════════════════════

// Track which tabs have unsaved changes
const unsavedTabs = new Set();
const ALL_TABS = ['exam','plan','bond','fu-fixed','fu-aligner','fu-gmd','emergency','debond','tad'];

// Mark current tab as having unsaved changes
function markUnsaved() {
  if (unsavedTabs.has(currentTab)) return; // already marked
  unsavedTabs.add(currentTab);
  const btn = document.getElementById('tbtn-' + currentTab);
  if (btn) btn.classList.add('has-unsaved');
}

// Clear unsaved mark for a tab (called after save)
function markSaved(tab) {
  unsavedTabs.delete(tab);
  const btn = document.getElementById('tbtn-' + tab);
  if (btn) btn.classList.remove('has-unsaved');
}

// Show the autosave indicator
function showAutosaveIndicator(state, msg) {
  const el   = document.getElementById('autosave-indicator');
  const text = document.getElementById('autosave-text');
  if (!el || !text) return;
  el.className = 'autosave-indicator visible ' + state;
  text.textContent = msg;
}

function hideAutosaveIndicator() {
  const el = document.getElementById('autosave-indicator');
  if (el) el.className = 'autosave-indicator';
}

// Silent auto-save for a single tab
function autoSaveTab(tab) {
  // Re-use the existing saveCurrentForm logic but for a specific tab
  const savedTab = currentTab;
  // Temporarily switch context for collection
  const panel = document.getElementById('panel-' + tab);
  if (!panel) return;

  const data = { _tab: tab };
  panel.querySelectorAll('input,select,textarea').forEach(el => {
    if (!el.id && !el.name) return;
    if (el.type === 'checkbox') data[el.id] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data['radio__' + el.name] = el.value; }
    else if (el.id) data[el.id] = el.value;
  });

  // Wire states
  ['bond-wire-selector','fuf-wire-selector','em-wire-selector','ref-wire-selector'].forEach(cid => {
    if (wireState[cid]) data['wires__' + cid] = wireState[cid];
  });
  if (tab === 'fu-fixed') {
    // Save short and fig8 sets separately as arrays
    data['_lig_upper_short'] = [...ligSelectedTeeth.upper.short];
    data['_lig_upper_fig8']  = [...ligSelectedTeeth.upper.fig8];
    data['_lig_lower_short'] = [...ligSelectedTeeth.lower.short];
    data['_lig_lower_fig8']  = [...ligSelectedTeeth.lower.fig8];
    ['upper','lower'].forEach(arch => {
      const cid = `fuf-aux-wire-${arch}`;
      if (wireState[cid]) data['wires__' + cid] = wireState[cid];
    });
  }
  if (tab === 'emergency') data['_em_pills'] = [...activeEmPills];
  if (tab === 'exam')      data['__teeth']   = { ...toothState };
  if (tab === 'referred')  data['_ref_ext_chart'] = [...refExtChartSet];
  if (tab === 'retention') {
    data['_ret_chart_upper'] = [...retChartSets.upper];
    data['_ret_chart_lower'] = [...retChartSets.lower];
  }

  localStorage.setItem('ortho_v4_' + tab, JSON.stringify(data));
  localStorage.setItem('ortho_v4_autosave_time', Date.now().toString());
  markSaved(tab);
}

// Auto-save all tabs that have unsaved changes
function runAutoSave() {
  const dirty = [...unsavedTabs];
  if (dirty.length === 0) return;

  showAutosaveIndicator('saving', 'جاري الحفظ التلقائي...');

  // Small delay so indicator appears before heavy work
  setTimeout(() => {
    dirty.forEach(tab => autoSaveTab(tab));
    showAutosaveIndicator('saved', '✓ تم الحفظ التلقائي');
    setTimeout(hideAutosaveIndicator, 2200);
  }, 120);
}

// Listen for ANY change in the page and mark current tab dirty
function onAnyChange() {
  markUnsaved();
}

document.addEventListener('input',  onAnyChange);
document.addEventListener('change', onAnyChange);

// Override saveCurrentForm to also clear unsaved mark
const _origSave = saveCurrentForm;
saveCurrentForm = function() {
  _origSave();
  markSaved(currentTab);
};

// Override clearCurrentForm to also clear unsaved mark
const _origClear = clearCurrentForm;
clearCurrentForm = function() {
  _origClear();
  markSaved(currentTab);
};

// Run auto-save every 60 seconds
setInterval(runAutoSave, 60_000);

// ── beforeunload — warn if there are unsaved changes ──────────────────
window.addEventListener('beforeunload', e => {
  if (unsavedTabs.size === 0) return; // nothing unsaved → let go freely

  // Auto-save silently first so data is not lost even if user leaves
  [...unsavedTabs].forEach(tab => autoSaveTab(tab));

  // Still show browser confirm dialog as an extra warning
  e.preventDefault();
  e.returnValue = ''; // required for Chrome to show the dialog
});

// ── Keyboard Shortcuts ────────────────────────────────────────────────
// Ctrl/Cmd+S  → Save draft
// Ctrl/Cmd+P  → Print
// Ctrl/Cmd+K  → Copy summary
// Ctrl/Cmd+→  → Next tab
// Ctrl/Cmd+←  → Previous tab
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  switch(e.key) {
    case 's': e.preventDefault(); saveCurrentForm();    break;
    case 'p': e.preventDefault(); printSummary();       break;
    case 'k': e.preventDefault(); copyCurrentSummary(); break;
    case 'ArrowRight': e.preventDefault(); cycleTab(1);  break;
    case 'ArrowLeft':  e.preventDefault(); cycleTab(-1); break;
  }
});

function cycleTab(dir) {
  const tabIds = ['exam','plan','bond','fu-fixed','fu-aligner','fu-gmd','emergency','debond','tad','referred','retention'];
  const cur = tabIds.indexOf(currentTab);
  const next = (cur + dir + tabIds.length) % tabIds.length;
  switchTab(tabIds[next]);
}

// ── Init ───────────────────────────────────────────────────────────────
(function init(){
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el=>el.value=today);

  // Default: all aseptic checkboxes checked
  ['aseptic-confirm','bond-aseptic','fuf-aseptic','fua-aseptic','em-aseptic','db-aseptic','ref-aseptic','ret-aseptic'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.checked=true;
  });

  applyAdminSchema();

  // Event delegation: استمع لكل التغييرات في document بدلاً من inline handlers
  // هذا يضمن عمل الـ handlers حتى بعد إعادة بناء الـ DOM من applyAdminSchema
  document.addEventListener('change', e => {
    const name = e.target.name;
    const id   = e.target.id;

    // Occlusal cant visibility
    if (name === 'occCant') updateOccCantVisibility();

    // Referred patient decision & extraction chart
    if (name === 'ref-decision')  updateRefDecision();
    if (name === 'ref-prev-ext')  toggleRefExtChart();

    // Retention follow-up
    if (name === 'ret-fr-upper-integrity') toggleRetChart('upper');
    if (name === 'ret-fr-lower-integrity') toggleRetChart('lower');
    if (name === 'ret-decision')           updateRetDecision();

    // GMD category & appliance type
    if (name === 'gmd-category')        updateGmdCategory();
    if (name === 'gmd-removable-type' || name === 'gmd-fixed-type') updateGmdDetailSection();
    if (name === 'gmd-cs-stage')        highlightCS();
    if (name === 'fug-decision')        updateGmdDecision();

    // Extraction chart
    if (name === 'plan-ext')            toggleExtChart();

    // TAD status
    if (id === 'fuf-has-tad')           toggleTadStatus('fuf');
    if (id === 'fua-has-tad')           toggleTadStatus('fua');

    // Appliance cards
    if (name === 'plan-appliance-type') updateApplianceCard();
    if (name === 'bond-type')           updateBondCard();

    // Bond summary
    if (name === 'bond-arch' || name === 'bond-rx' || name === 'bond-brand') updateBondSummary();

    // Aligner progress
    if (id === 'fua-current-aligner' || id === 'fua-total-aligners') updateAlignerProgress();

    // Elastic config
    if (name === 'bond-elastic-config') toggleElasticConfig('bond');
    if (name === 'fuf-elastic-config')  toggleElasticConfig('fuf');
    if (name === 'fua-elastic-config')  toggleElasticConfig('fua');

    // Ligature charts
    if (id === 'fuf-lig-upper-short' || id === 'fuf-lig-upper-fig8') toggleLigChart('upper');
    if (id === 'fuf-lig-lower-short' || id === 'fuf-lig-lower-fig8') toggleLigChart('lower');

    // Aux wire
    if (id === 'fuf-aux-wire-upper-en') toggleAuxWire('upper');
    if (id === 'fuf-aux-wire-lower-en') toggleAuxWire('lower');

    // GMD Follow-up calculations
    if (id === 'fug-oj-now' || id === 'fug-ob-now' || id === 'fug-lfh-now') calcGmdChange();
  });

  // input event للـ aligner progress (number inputs)
  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'fua-current-aligner' || id === 'fua-total-aligners') updateAlignerProgress();
    if (id === 'fug-oj-now' || id === 'fug-ob-now' || id === 'fug-lfh-now') calcGmdChange();
  });
  ['exam','plan','bond','fu-fixed','fu-aligner','fu-gmd','emergency','debond','tad','referred','retention'].forEach(loadForm);
  updateApplianceCard();
  updateBondCard();
  updateProgress();

  // Default: all aseptic checkboxes checked (including tad)
  ['aseptic-confirm','bond-aseptic','fuf-aseptic','fua-aseptic','fug-aseptic','em-aseptic','db-aseptic','tad-aseptic','ref-aseptic','ret-aseptic'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.checked=true;
  });

  // Initialize TAD with one screw by default
  if (tadScrews.length === 0) tadAddScrew();

  // Show last autosave time if available
  const lastSave = localStorage.getItem('ortho_v4_autosave_time');
  if (lastSave) {
    const diff = Math.round((Date.now() - parseInt(lastSave)) / 60000);
    if (diff < 60) {
      showAutosaveIndicator('saved', `✓ آخر حفظ: منذ ${diff === 0 ? 'أقل من دقيقة' : diff + ' دقيقة'}`);
      setTimeout(hideAutosaveIndicator, 3000);
    }
  }
})();
// ══════════════════════════════════════════════════════════════
// PWA — Service Worker + Install Prompt
// ══════════════════════════════════════════════════════════════
// ── PWA Service Worker Registration ───────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(reg => {
      console.log('EasyOrtho SW registered:', reg.scope);
      // Check for updates every 10 minutes
      setInterval(() => reg.update(), 10 * 60 * 1000);
      
      // When a new SW is waiting, offer the user a refresh
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    })
    .catch(err => console.warn('SW registration failed (offline mode disabled):', err));

  // Listen for SW_UPDATED message (sent after activation)
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATED') showUpdateBanner();
  });
}

function showUpdateBanner() {
  // Don't show twice
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    position:fixed; bottom:70px; left:50%; transform:translateX(-50%);
    background:#1a5c3a; color:white; padding:10px 18px; border-radius:10px;
    font-size:0.84rem; font-weight:600; z-index:99999; display:flex;
    align-items:center; gap:12px; box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation:slideUp 0.3s ease;
  `;
  banner.innerHTML = `
    <span>🔄 تحديث جديد متاح</span>
    <button onclick="window.location.reload()" style="
      background:white; color:#1a5c3a; border:none; border-radius:6px;
      padding:4px 12px; font-weight:700; cursor:pointer; font-size:0.8rem;">
      تحديث الآن
    </button>
    <button onclick="this.parentElement.remove()" style="
      background:transparent; color:rgba(255,255,255,0.6); border:none;
      cursor:pointer; font-size:1rem; padding:0 4px;">✕</button>
  `;
  const style = document.createElement('style');
  style.textContent = '@keyframes slideUp{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
  document.head.appendChild(style);
  document.body.appendChild(banner);
  // Auto-dismiss after 15 seconds
  setTimeout(() => banner?.remove(), 15000);
}

// ── PWA Install Prompt ─────────────────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const installBtn = document.createElement('button');
  installBtn.id = 'pwa-install-btn';
  installBtn.className = 'btn btn-ghost btn-sm';
  installBtn.innerHTML = '📲 Install App';
  installBtn.title = 'Install EasyOrtho as an app on this device';
  installBtn.style.cssText = 'color:rgba(201,168,76,0.8);border-color:rgba(201,168,76,0.3);animation:pulse-gold 2s infinite;';
  installBtn.onclick = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') installBtn.remove();
    deferredInstallPrompt = null;
  };
  const style = document.createElement('style');
  style.textContent = `@keyframes pulse-gold{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0.3)}50%{box-shadow:0 0 0 6px rgba(201,168,76,0)}}`;
  document.head.appendChild(style);
  const headerActions = document.querySelector('.header-right');
  if (headerActions) headerActions.prepend(installBtn);
});

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.remove();
  deferredInstallPrompt = null;
});
