// ===== ฐานข้อมูล (IndexedDB ผ่าน Dexie.js) =====
const db = new Dexie('TuangKuayJubDB');

db.version(1).stores({
  menuItems:      '++id, category, active',
  dailySales:     '++id, &date',
  rawMaterials:   '++id, name, countFreq',
  stockReceiving: '++id, date, materialId',
  stockCounts:    '++id, date, materialId',
  consumptionLog: '++id, date, materialId',
  expenses:       '++id, date, category',
  settings:       '&key'
});

// ---------- ค่าเริ่มต้น (เมนูตัวอย่างของร้าน) ----------
async function seedIfEmpty() {
  const count = await db.menuItems.count();
  if (count === 0) {
    await db.menuItems.bulkAdd([
      { name: 'บุฟเฟต์ผู้ใหญ่', category: 'buffet', price: 79, active: 1, sortOrder: 1 },
      { name: 'เกาเหลา',        category: 'buffet', price: 79, active: 1, sortOrder: 2 },
      { name: 'บุฟเฟต์เด็ก',    category: 'buffet', price: 39, active: 1, sortOrder: 3 },
      { name: 'น้ำเปล่า',       category: 'drink',  price: 10, active: 1, sortOrder: 4 },
      { name: 'น้ำอัดลม',       category: 'drink',  price: 15, active: 1, sortOrder: 5 },
    ]);
  }
}

// ---------- เมนู ----------
const MenuAPI = {
  list: (activeOnly = false) =>
    activeOnly ? db.menuItems.where('active').equals(1).sortBy('sortOrder')
               : db.menuItems.toCollection().sortBy('sortOrder'),
  add: (item) => db.menuItems.add({ active: 1, sortOrder: Date.now(), ...item }),
  update: (id, changes) => db.menuItems.update(id, changes),
  remove: (id) => db.menuItems.update(id, { active: 0 }), // ปิดขายแทนการลบ เพื่อรักษาประวัติ
};

// ---------- ยอดขายรายวัน ----------
const SalesAPI = {
  getByDate: (date) => db.dailySales.where('date').equals(date).first(),
  save: async (date, lines, actualRevenue, note) => {
    const calculatedTotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const existing = await db.dailySales.where('date').equals(date).first();
    const record = { date, lines, calculatedTotal, actualRevenue, note, updatedAt: Date.now() };
    if (existing) return db.dailySales.update(existing.id, record);
    return db.dailySales.add(record);
  },
  range: (from, to) => db.dailySales.where('date').between(from, to, true, true).sortBy('date'),
  all: () => db.dailySales.toCollection().sortBy('date'),
};

// ---------- วัตถุดิบ ----------
const MaterialAPI = {
  list: () => db.rawMaterials.toCollection().sortBy('name'),
  add: (m) => db.rawMaterials.add({ onHandQty: 0, avgCost: 0, countFreq: 'daily', ...m }),
  update: (id, changes) => db.rawMaterials.update(id, changes),
  remove: (id) => db.rawMaterials.delete(id),
  get: (id) => db.rawMaterials.get(id),

  // บันทึกรับเข้า -> อัพเดตต้นทุนเฉลี่ยถ่วงน้ำหนัก (moving average)
  receive: async (materialId, date, qty, unitCost, supplier) => {
    const mat = await db.rawMaterials.get(materialId);
    const oldQty = mat.onHandQty || 0;
    const oldCost = mat.avgCost || 0;
    const newQty = oldQty + qty;
    const newAvgCost = newQty > 0 ? (oldQty * oldCost + qty * unitCost) / newQty : unitCost;
    await db.rawMaterials.update(materialId, { onHandQty: newQty, avgCost: newAvgCost });
    await db.stockReceiving.add({
      date, materialId, materialName: mat.name, unit: mat.unit,
      qty, unitCost, totalCost: qty * unitCost, supplier: supplier || '',
    });
  },

  // บันทึกนับคงเหลือ -> คำนวณปริมาณที่ใช้ไปและต้นทุน แล้วรีเซ็ต onHandQty
  count: async (materialId, date, countedQty) => {
    const mat = await db.rawMaterials.get(materialId);
    const before = mat.onHandQty || 0;
    const usageQty = before - countedQty; // ติดลบ = นับได้มากกว่าคาด (ควรตรวจสอบ)
    const cost = usageQty * (mat.avgCost || 0);
    await db.stockCounts.add({ date, materialId, materialName: mat.name, countedQty, onHandBefore: before });
    await db.consumptionLog.add({ date, materialId, materialName: mat.name, usageQty, unitCost: mat.avgCost || 0, cost });
    await db.rawMaterials.update(materialId, { onHandQty: countedQty, lastCountDate: date });
    return { usageQty, cost };
  },

  consumptionInRange: (from, to) =>
    db.consumptionLog.where('date').between(from, to, true, true).toArray(),
};

// ---------- รายจ่าย ----------
const ExpenseAPI = {
  add: (expense) => db.expenses.add({ createdAt: Date.now(), ...expense }),
  update: (id, changes) => db.expenses.update(id, changes),
  remove: (id) => db.expenses.delete(id),
  range: (from, to) => db.expenses.where('date').between(from, to, true, true).sortBy('date'),
};

// ---------- Export / Import ทั้งฐานข้อมูล ----------
const BackupAPI = {
  exportAll: async () => {
    const tables = ['menuItems','dailySales','rawMaterials','stockReceiving','stockCounts','consumptionLog','expenses'];
    const data = {};
    for (const t of tables) data[t] = await db[t].toArray();
    data._meta = { exportedAt: new Date().toISOString(), app: 'tuang-kuay-jub', version: 1 };
    return data;
  },
  importAll: async (data) => {
    const tables = ['menuItems','dailySales','rawMaterials','stockReceiving','stockCounts','consumptionLog','expenses'];
    await db.transaction('rw', tables.map(t => db[t]), async () => {
      for (const t of tables) {
        if (Array.isArray(data[t])) {
          await db[t].clear();
          await db[t].bulkAdd(data[t]);
        }
      }
    });
  },
};
