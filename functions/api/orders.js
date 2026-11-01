export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { customer_name, customer_phone, customer_address, total, items } = body;

    // ---------- التحقق ----------
    if (!customer_name || !customer_phone) {
      return jsonError('الاسم والهاتف مطلوبان', 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return jsonError('السلة فارغة', 400);
    }
    if (typeof total !== 'number' || total <= 0) {
      return jsonError('المجموع غير صالح', 400);
    }

    // ---------- 1) إنشاء الطلب ----------
    const insertOrder = env.DB.prepare(
      `INSERT INTO orders (customer_name, customer_phone, customer_address, total, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).bind(
      customer_name,
      customer_phone,
      customer_address || '',
      total
    );
    const orderResult = await insertOrder.run();

    if (!orderResult.success || !orderResult.meta.last_row_id) {
      return jsonError('فشل إنشاء الطلب', 500);
    }
    const orderId = orderResult.meta.last_row_id;

    // ---------- 2) إدخال عناصر الطلب (batch) ----------
    const stmts = items.map(item =>
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`
      ).bind(orderId, item.product_id, item.quantity, item.price)
    );

    await env.DB.batch(stmts);

    // ---------- 3) الرد ----------
    return new Response(JSON.stringify({
      ok: true,
      order_id: orderId,
      message: 'تم حفظ الطلب بنجاح'
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err) {
    return jsonError('خطأ في الخادم: ' + err.message, 500);
  }
}

function jsonError(msg, status) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
