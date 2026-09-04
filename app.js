// ================= Helpers =================
function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function fmtMoney(n) {
  n = Number(n) || 0;
  return '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}
function daysAgo(dateStr, fromStr) {
  return Math.floor((new Date(fromStr) - new Date(dateStr)) / 86400000);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
const THAI_WEEKDAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

// ================= Router =================
const Router = {
  current: 'home',
  currentSub: {},
  go(page, sub) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('nav.bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    this.current = page;
    if (sub) this.goSub(page, sub);
    this.render(page, sub);
    window.scrollTo(0, 0);
  },
  goSub(page, sub) {
    this.currentSub[page] = sub;
    const map = { stock: 'stockSubtabs', accounting: 'acctSubtabs' };
    const prefix = page === 'stock' ? 'stock' : 'acct';
    if (map[page]) {
      document.querySelectorAll('#' + map[page] + ' button').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
      document.querySelectorAll('#page-' + page + ' .subpage').forEach(el => {
        el.style.display = (el.id === prefix + '-' + sub) ? '' : 'none';
      });
    }
  },
  render(page, sub) {
    if (page === 'home') renderHome();
    if (page === 'sales') renderSales();
    if (page === 'stock') {
      const s = sub || this.currentSub.stock || 'menu';
      if (s === 'menu') renderStockMenu();
      if (s === 'receive') renderStockReceive();
      if (s === 'count') renderStockCount();
      if (s === 'materials') renderStockMaterials();
    }
    if (page === 'reports') renderReports();
    if (page === 'accounting') {
      const s = sub || this.currentSub.accounting || 'expense';
      if (s === 'expense') renderExpenseList();
      if (s === 'pl') { /* wait for user to pick range */ }
    }
  }
};

// ================= Init =================
document.addEventListener('DOMContentLoaded', async () => {
  await seedIfEmpty();
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  document.querySelectorAll('nav.bottomnav button').forEach(b => {
    b.addEventListener('click', () => Router.go(b.dataset.page));
  });
  document.querySelectorAll('#stockSubtabs button').forEach(b => {
    b.addEventListener('click', () => Router.goSub('stock', b.dataset.sub) || Router.render('stock', b.dataset.sub));
  });
  document.querySelectorAll('#acctSubtabs button').forEach(b => {
    b.addEventListener('click', () => Router.goSub('accounting', b.dataset.sub) || Router.render('accounting', b.dataset.sub));
  });

  document.getElementById('salesDate').value = todayStr();
  document.getElementById('recvDate').value = todayStr();
  document.getElementById('countDate').value = todayStr();
  document.getElementById('expDate').value = todayStr();

  document.getElementById('salesDate').addEventListener('change', renderSales);
  document.getElementById('recvDate').addEventListener('change', renderStockReceive);
  document.getElementById('countDate').addEventListener('change', renderStockCount);

  document.getElementById('btnAddMenu').addEventListener('click', addMenuItem);
  document.getElementById('btnSaveSales').addEventListener('click', saveSales);
  document.getElementById('btnSaveReceive').addEventListener('click', saveReceive);
  document.getElementById('btnSaveCount').addEventListener('click', saveCount);
  document.getElementById('btnAddMaterial').addEventListener('click', addMaterial);
  document.getElementById('btnSaveExpense').addEventListener('click', saveExpense);
  document.getElementById('btnRunPL').addEventListener('click', runPL);

  document.getElementById('btnExport').addEventListener('click', doExport);
  document.getElementById('btnImportTrigger').addEventListener('click', () => document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', doImport);

  document.getElementById('plFrom').value = addDays(todayStr(), -30);
  document.getElementById('plTo').value = todayStr();
  document.getElementById('reportFrom').value = addDays(todayStr(), -7);
  document.getElementById('reportTo').value = todayStr();

  document.querySelectorAll('#reportRangeTabs button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#reportRangeTabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      document.getElementById('reportCustomRange').style.display = b.dataset.range === 'custom' ? 'flex' : 'none';
      if (b.dataset.range !== 'custom') {
        document.getElementById('reportFrom').value = addDays(todayStr(), -parseInt(b.dataset.range));
        document.getElementById('reportTo').value = todayStr();
      }
      renderReports();
    });
  });
  document.getElementById('reportFrom').addEventListener('change', renderReports);
  document.getElementById('reportTo').addEventListener('change', renderReports);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  Router.go('home');
});

// ================= หน้าแรก =================
async function renderHome() {
  const date = todayStr();
  const sale = await SalesAPI.getByDate(date);
  const expenses = await ExpenseAPI.range(date, date);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const consumption = await MaterialAPI.consumptionInRange(date, date);
  const cogsToday = consumption.reduce((s, c) => s + c.cost, 0);

  const actual = sale ? Number(sale.actualRevenue || 0) : 0;
  const calc = sale ? sale.calculatedTotal : 0;
  const profit = actual - expenseTotal - cogsToday;

  document.getElementById('homeCalc').textContent = fmtMoney(calc);
  document.getElementById('homeActual').textContent = fmtMoney(actual);
  document.getElementById('homeExpense').textContent = fmtMoney(expenseTotal + cogsToday);
  const profitEl = document.getElementById('homeProfit');
  profitEl.textContent = fmtMoney(profit);
  profitEl.className = 'value ' + (profit >= 0 ? 'pos' : 'neg');
  document.getElementById('homeSalesStatus').textContent = sale ? 'บันทึกยอดขายวันนี้แล้ว' : 'ยังไม่ได้บันทึกยอดขายวันนี้';

  const materials = await MaterialAPI.list();
  const due = materials.filter(m => isCountDue(m, date));
  const wrap = document.getElementById('homeCountDue');
  wrap.innerHTML = due.length
    ? due.map(m => `<div class="list-item"><span>${m.name}</span><span class="tag ${m.countFreq}">${m.countFreq === 'daily' ? 'รายวัน' : 'รายสัปดาห์'}</span></div>`).join('')
    : '<div class="empty-state">วันนี้ไม่มีรายการที่ต้องนับ</div>';
}

function isCountDue(material, date) {
  if (material.countFreq === 'daily') return true;
  if (!material.lastCountDate) return true;
  return daysAgo(material.lastCountDate, date) >= 7;
}

// ================= ขายวันนี้ =================
async function renderSales() {
  const date = document.getElementById('salesDate').value || todayStr();
  const items = await MenuAPI.list(true);
  const existing = await SalesAPI.getByDate(date);
  const existingMap = {};
  if (existing) existing.lines.forEach(l => existingMap[l.menuItemId] = l.qty);

  const wrap = document.getElementById('salesLines');
  wrap.innerHTML = items.map(it => `
    <div class="qty-row" data-id="${it.id}" data-price="${it.price}">
      <div>
        <div class="qname">${it.name}</div>
        <div class="qprice">${fmtMoney(it.price)}</div>
      </div>
      <div class="qty-stepper">
        <button type="button" class="dec">−</button>
        <input type="number" class="qtyInput" min="0" value="${existingMap[it.id] || 0}">
        <button type="button" class="inc">+</button>
      </div>
    </div>`).join('') || '<div class="empty-state">ยังไม่มีเมนู กรุณาเพิ่มเมนูในหน้า "คลัง"</div>';

  wrap.querySelectorAll('.qty-row').forEach(row => {
    const input = row.querySelector('.qtyInput');
    row.querySelector('.dec').addEventListener('click', () => { input.value = Math.max(0, Number(input.value || 0) - 1); updateSalesTotal(); });
    row.querySelector('.inc').addEventListener('click', () => { input.value = Number(input.value || 0) + 1; updateSalesTotal(); });
    input.addEventListener('input', updateSalesTotal);
  });

  document.getElementById('salesActual').value = existing ? existing.actualRevenue : '';
  document.getElementById('salesNote').value = existing ? (existing.note || '') : '';
  updateSalesTotal();
}
function updateSalesTotal() {
  let total = 0;
  document.querySelectorAll('#salesLines .qty-row').forEach(row => {
    const qty = Number(row.querySelector('.qtyInput').value || 0);
    const price = Number(row.dataset.price);
    total += qty * price;
  });
  document.getElementById('salesCalcTotal').textContent = fmtMoney(total);
}
async function saveSales() {
  const date = document.getElementById('salesDate').value;
  const lines = [];
  document.querySelectorAll('#salesLines .qty-row').forEach(row => {
    const qty = Number(row.querySelector('.qtyInput').value || 0);
    if (qty > 0) lines.push({ menuItemId: Number(row.dataset.id), name: row.querySelector('.qname').textContent, price: Number(row.dataset.price), qty });
  });
  const actual = Number(document.getElementById('salesActual').value || 0);
  const note = document.getElementById('salesNote').value.trim();
  await SalesAPI.save(date, lines, actual, note);
  toast('บันทึกยอดขายเรียบร้อย');
  Router.go('home');
}

// ================= คลังเมนู =================
async function addMenuItem() {
  const name = document.getElementById('menuName').value.trim();
  const price = Number(document.getElementById('menuPrice').value);
  const category = document.getElementById('menuCategory').value;
  if (!name || !price) return toast('กรอกชื่อและราคาให้ครบ');
  await MenuAPI.add({ name, price, category });
  document.getElementById('menuName').value = '';
  document.getElementById('menuPrice').value = '';
  toast('เพิ่มเมนูแล้ว');
  renderStockMenu();
}
async function renderStockMenu() {
  const items = await MenuAPI.list();
  const wrap = document.getElementById('menuList');
  wrap.innerHTML = items.map(it => `
    <div class="list-item">
      <span>${it.name} <span class="meta">(${fmtMoney(it.price)}${it.category === 'drink' ? ' · เครื่องดื่ม' : ''})</span></span>
      <button class="btn ${it.active ? 'ghost' : 'secondary'} small" data-id="${it.id}" data-active="${it.active}">${it.active ? 'ปิดขาย' : 'เปิดขาย'}</button>
    </div>`).join('') || '<div class="empty-state">ยังไม่มีเมนู</div>';
  wrap.querySelectorAll('button[data-id]').forEach(b => {
    b.addEventListener('click', async () => {
      await MenuAPI.update(Number(b.dataset.id), { active: b.dataset.active === '1' ? 0 : 1 });
      renderStockMenu();
    });
  });
}

// ================= คลังวัตถุดิบ =================
async function addMaterial() {
  const name = document.getElementById('matName').value.trim();
  const unit = document.getElementById('matUnit').value.trim();
  const countFreq = document.getElementById('matFreq').value;
  if (!name || !unit) return toast('กรอกชื่อและหน่วยให้ครบ');
  await MaterialAPI.add({ name, unit, countFreq });
  document.getElementById('matName').value = '';
  document.getElementById('matUnit').value = '';
  toast('เพิ่มวัตถุดิบแล้ว');
  renderStockMaterials();
}
async function renderStockMaterials() {
  const mats = await MaterialAPI.list();
  const wrap = document.getElementById('materialList');
  wrap.innerHTML = mats.map(m => `
    <div class="list-item">
      <span>${m.name} <span class="meta">คงเหลือ ${m.onHandQty.toFixed(2)} ${m.unit} · ต้นทุนเฉลี่ย ${fmtMoney(m.avgCost)}/${m.unit}</span></span>
      <span class="tag ${m.countFreq}">${m.countFreq === 'daily' ? 'รายวัน' : 'รายสัปดาห์'}</span>
    </div>`).join('') || '<div class="empty-state">ยังไม่มีวัตถุดิบ</div>';

  const sel = document.getElementById('recvMaterial');
  if (sel) sel.innerHTML = mats.map(m => `<option value="${m.id}">${m.name} (${m.unit})</option>`).join('');
}

// ================= รับเข้าวัตถุดิบ =================
async function renderStockReceive() {
  await renderStockMaterials();
  const date = document.getElementById('recvDate').value;
  const history = await db.stockReceiving.orderBy('id').reverse().limit(15).toArray();
  document.getElementById('recvHistory').innerHTML = history.map(h => `
    <div class="list-item">
      <span>${h.date} · ${h.materialName}</span>
      <span class="meta">${h.qty} ${h.unit} × ${fmtMoney(h.unitCost)} = ${fmtMoney(h.totalCost)}</span>
    </div>`).join('') || '<div class="empty-state">ยังไม่มีประวัติรับเข้า</div>';
}
async function saveReceive() {
  const date = document.getElementById('recvDate').value;
  const materialId = Number(document.getElementById('recvMaterial').value);
  const qty = Number(document.getElementById('recvQty').value);
  const unitCost = Number(document.getElementById('recvUnitCost').value);
  const supplier = document.getElementById('recvSupplier').value.trim();
  if (!materialId || !qty || !unitCost) return toast('กรอกข้อมูลให้ครบ');
  await MaterialAPI.receive(materialId, date, qty, unitCost, supplier);
  document.getElementById('recvQty').value = '';
  document.getElementById('recvUnitCost').value = '';
  document.getElementById('recvSupplier').value = '';
  toast('บันทึกรับเข้าแล้ว');
  renderStockReceive();
}

// ================= นับสต๊อกคงเหลือ =================
async function renderStockCount() {
  const date = document.getElementById('countDate').value;
  const mats = await MaterialAPI.list();
  const due = mats.filter(m => isCountDue(m, date));
  const wrap = document.getElementById('countLines');
  wrap.innerHTML = due.map(m => `
    <div class="qty-row" data-id="${m.id}">
      <div><div class="qname">${m.name}</div><div class="qprice">คาดว่ามี ${m.onHandQty.toFixed(2)} ${m.unit}</div></div>
      <div class="qty-stepper"><input type="number" class="countInput" step="0.01" placeholder="${m.unit}"></div>
    </div>`).join('') || '<div class="empty-state">วันนี้ไม่มีรายการที่ต้องนับ</div>';
}
async function saveCount() {
  const date = document.getElementById('countDate').value;
  const rows = document.querySelectorAll('#countLines .qty-row');
  let saved = 0;
  for (const row of rows) {
    const val = row.querySelector('.countInput').value;
    if (val === '') continue;
    await MaterialAPI.count(Number(row.dataset.id), date, Number(val));
    saved++;
  }
  if (saved === 0) return toast('กรุณากรอกจำนวนที่นับได้อย่างน้อย 1 รายการ');
  toast(`บันทึกการนับสต๊อกแล้ว (${saved} รายการ)`);
  renderStockCount();
}

// ================= รายจ่าย =================
async function saveExpense() {
  const date = document.getElementById('expDate').value;
  const category = document.getElementById('expCategory').value;
  const description = document.getElementById('expDesc').value.trim();
  const amount = Number(document.getElementById('expAmount').value);
  const fileInput = document.getElementById('expReceipt');
  if (!description || !amount) return toast('กรอกรายละเอียดและจำนวนเงินให้ครบ');

  let receiptImage = null;
  if (fileInput.files[0]) receiptImage = await fileToDataURL(fileInput.files[0]);

  await ExpenseAPI.add({ date, category, description, amount, receiptImage });
  document.getElementById('expDesc').value = '';
  document.getElementById('expAmount').value = '';
  fileInput.value = '';
  toast('บันทึกรายจ่ายแล้ว');
  renderExpenseList();
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function renderExpenseList() {
  const list = await db.expenses.orderBy('id').reverse().limit(20).toArray();
  const wrap = document.getElementById('expenseList');
  wrap.innerHTML = list.map(e => `
    <div class="list-item">
      ${e.receiptImage ? `<img class="receipt-thumb" src="${e.receiptImage}">` : ''}
      <span style="flex:1; margin-left:${e.receiptImage ? '10px' : '0'};">
        ${e.description}
        <span class="meta">${e.date} · ${e.category === 'operating' ? 'ดำเนินงาน' : 'วัตถุดิบ'}</span>
      </span>
      <strong>${fmtMoney(e.amount)}</strong>
    </div>`).join('') || '<div class="empty-state">ยังไม่มีรายจ่าย</div>';
}

// ================= รายงาน =================
async function renderReports() {
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  if (!from || !to) return;

  const sales = await SalesAPI.range(from, to);
  const consumption = await MaterialAPI.consumptionInRange(from, to);
  const expenses = await ExpenseAPI.range(from, to);

  const revenue = sales.reduce((s, x) => s + Number(x.actualRevenue || 0), 0);
  const cogs = consumption.reduce((s, c) => s + c.cost, 0);
  const opex = expenses.filter(e => e.category === 'operating').reduce((s, e) => s + Number(e.amount), 0);
  const profit = revenue - cogs - opex;

  document.getElementById('repRevenue').textContent = fmtMoney(revenue);
  document.getElementById('repCogs').textContent = fmtMoney(cogs);
  document.getElementById('repOpex').textContent = fmtMoney(opex);
  const profitEl = document.getElementById('repProfit');
  profitEl.textContent = fmtMoney(profit);
  profitEl.className = 'value ' + (profit >= 0 ? 'pos' : 'neg');

  drawDailyChart(sales, from, to);
  drawWeekdayChart(sales);
}

let dailyChartInstance, weekdayChartInstance;
function drawDailyChart(sales, from, to) {
  const map = {};
  sales.forEach(s => map[s.date] = Number(s.actualRevenue || 0));
  const labels = [];
  let d = from;
  while (d <= to) { labels.push(d); d = addDays(d, 1); }
  const data = labels.map(l => map[l] || 0);

  const ctx = document.getElementById('chartDaily').getContext('2d');
  if (dailyChartInstance) dailyChartInstance.destroy();
  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: labels.map(l => l.slice(5)), datasets: [{ label: 'รายรับจริง', data, borderColor: '#8C2F2F', backgroundColor: 'rgba(140,47,47,0.1)', tension: 0.25, fill: true }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}
function drawWeekdayChart(sales) {
  const sums = [0,0,0,0,0,0,0];
  const counts = [0,0,0,0,0,0,0];
  sales.forEach(s => {
    const wd = new Date(s.date).getDay();
    sums[wd] += Number(s.actualRevenue || 0);
    counts[wd]++;
  });
  const avgs = sums.map((s, i) => counts[i] ? s / counts[i] : 0);

  const ctx = document.getElementById('chartWeekday').getContext('2d');
  if (weekdayChartInstance) weekdayChartInstance.destroy();
  weekdayChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: THAI_WEEKDAYS, datasets: [{ label: 'เฉลี่ยรายรับจริง', data: avgs, backgroundColor: '#C97A1E' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const validIdx = counts.map((c, i) => c > 0 ? i : -1).filter(i => i >= 0);
  if (validIdx.length >= 3) {
    const minIdx = validIdx.reduce((a, b) => avgs[a] <= avgs[b] ? a : b);
    document.getElementById('weekdaySuggestion').textContent =
      `จากข้อมูลที่มี วัน${THAI_WEEKDAYS[minIdx]}มีรายรับเฉลี่ยต่ำสุด (${fmtMoney(avgs[minIdx])}) — ลองเทียบกับต้นทุนคงที่ต่อวันเพื่อพิจารณาว่าควรหยุดร้านวันนี้หรือไม่`;
  } else {
    document.getElementById('weekdaySuggestion').textContent = 'ต้องมีข้อมูลมากขึ้นก่อนจึงจะวิเคราะห์ได้แม่นยำ';
  }
}

// ================= กำไรขาดทุน (ช่วงกำหนดเอง) =================
async function runPL() {
  const from = document.getElementById('plFrom').value;
  const to = document.getElementById('plTo').value;
  if (!from || !to) return toast('กรุณาเลือกช่วงวันที่');

  const sales = await SalesAPI.range(from, to);
  const consumption = await MaterialAPI.consumptionInRange(from, to);
  const expenses = await ExpenseAPI.range(from, to);

  const revenue = sales.reduce((s, x) => s + Number(x.actualRevenue || 0), 0);
  const cogsFromStock = consumption.reduce((s, c) => s + c.cost, 0);
  const cogsFromExpense = expenses.filter(e => e.category === 'rawMaterial').reduce((s, e) => s + Number(e.amount), 0);
  const cogs = cogsFromStock + cogsFromExpense;
  const opex = expenses.filter(e => e.category === 'operating').reduce((s, e) => s + Number(e.amount), 0);
  const gross = revenue - cogs;
  const net = gross - opex;

  document.getElementById('plRevenue').textContent = fmtMoney(revenue);
  document.getElementById('plCogs').textContent = fmtMoney(cogs);
  document.getElementById('plGross').textContent = fmtMoney(gross);
  document.getElementById('plOpex').textContent = fmtMoney(opex);
  const netEl = document.getElementById('plNet');
  netEl.textContent = fmtMoney(net);
  netEl.className = net >= 0 ? 'pos' : 'neg';
  document.getElementById('plResult').style.display = '';
}

// ================= Export / Import =================
async function doExport() {
  const data = await BackupAPI.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tuang-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export ข้อมูลเรียบร้อย');
}
async function doImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('การ Import จะแทนที่ข้อมูลทั้งหมดในเครื่องนี้ ยืนยันหรือไม่?')) { e.target.value = ''; return; }
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    await BackupAPI.importAll(data);
    toast('Import ข้อมูลสำเร็จ');
    location.reload();
  } catch (err) {
    toast('ไฟล์ไม่ถูกต้อง ไม่สามารถ Import ได้');
  }
  e.target.value = '';
}
