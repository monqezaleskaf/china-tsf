export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    // 1. التحقق من كلمة المرور
    const authHeader = request.headers.get('X-Admin-Password') || '';
    const passRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'admin_password'"
    ).first();
    const correctPass = passRow ? passRow.value : '';

    if (!correctPass || authHeader !== correctPass) {
      return jsonError('كلمة المرور غير صحيحة', 401);
    }

    // 2. استقبال ID المنتج
    const body = await request.json();
    const { product_id } = body;

    if (!product_id) return jsonError('رقم المنتج مطلوب', 400);

    // 3. التحقق من وجود طلبات مرتبطة بالمنتج
    const orderItem = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?'
    ).bind(product_id).first();

    if (orderItem && orderItem.count > 0) {
      // حذف عناصر الطلب أولاً (لتجنب خطأ المفتاح الأجنبي)
      await env.DB.prepare('DELETE FROM order_items WHERE product_id = ?').bind(product_id).run();
    }

    // 4. حذف المنتج
    const result = await env.DB.prepare(
      'DELETE FROM products WHERE id = ?'
    ).bind(product_id).run();

    if (!result.success || result.meta.changes === 0) {
      return jsonError('لم يتم العثور على المنتج', 404);
    }

    return new Response(JSON.stringify({ ok: true, message: 'تم حذف المنتج بنجاح' }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err) {
    return jsonError('خطأ: ' + err.message, 500);
  }
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
