export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    // ---------- 1) التحقق من كلمة المرور ----------
    const authHeader = request.headers.get('X-Admin-Password') || '';
    const passRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'admin_password'"
    ).first();
    const correctPass = passRow ? passRow.value : '';

    if (!correctPass || authHeader !== correctPass) {
      return jsonError('كلمة المرور غير صحيحة', 401);
    }

    // ---------- 2) استقبال الملف ----------
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      return jsonError('يرجى إرسال ملف بصيغة CSV', 400);
    }

    const csvText = await file.text();
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);

    if (lines.length < 2) return jsonError('الملف فارغ', 400);

    // ---------- 3) تحليل رأس الجدول ----------
    const headers = parseCSVLine(lines[0].trim()).map(h => h.trim().toLowerCase());
    
    // البحث عن الأعمدة
    const idIdx = headers.indexOf('unique_id');
    const stockIdx = headers.indexOf('stock');
    const nameIdx = headers.indexOf('name');
    const priceIdx = headers.indexOf('price_usd');
    const brandIdx = headers.indexOf('brand');
    const catIdx = headers.indexOf('category');

    // يجب أن يحتوي الملف على الأقل على unique_id (الرقم الفريد) والاسم
    if (idIdx === -1 || nameIdx === -1) {
      return jsonError('الملف يجب أن يحتوي على الأقل على: unique_id, name', 400);
    }

    // ---------- 4) معالجة الصفوف ----------
    let added = 0;
    let updated = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i].trim());
      if (cols.length <= idIdx) continue;

      const id = parseInt(cols[idIdx]);
      const name = cols[nameIdx] ? cols[nameIdx].trim() : '';

      // إذا كان الـ id أو الاسم فارغاً، تخطى السطر
      if (isNaN(id) || !name) continue;

      // استخراج باقي القيم (إذا كانت الأعمدة موجودة)
      const stock = stockIdx !== -1 && cols[stockIdx] ? parseInt(cols[stockIdx]) : 0;
      const price = priceIdx !== -1 && cols[priceIdx] ? parseFloat(cols[priceIdx]) : 0;
      const brand = brandIdx !== -1 && cols[brandIdx] ? cols[brandIdx].trim() : 'أخرى';
      const category = catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim() : 'عام';

      // التحقق هل المنتج موجود؟
      const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();

      if (existing) {
        // تحديث جميع الحقول
        await env.DB.prepare(
          'UPDATE products SET name = ?, brand = ?, category = ?, price = ?, stock = ? WHERE id = ?'
        ).bind(name, brand, category, price, stock, id).run();
        updated++;
      } else {
        // إضافة منتج جديد
        await env.DB.prepare(
          'INSERT INTO products (id, name, brand, category, price, stock) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, name, brand, category, price, stock).run();
        added++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      added,
      updated,
      total: lines.length - 1
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err) {
    return jsonError('خطأ: ' + err.message, 500);
  }
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
