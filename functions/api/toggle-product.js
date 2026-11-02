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

    // 3. عكس حالة الإخفاء (0 -> 1، 1 -> 0)
    const product = await env.DB.prepare(
      'SELECT id, is_hidden FROM products WHERE id = ?'
    ).bind(product_id).first();

    if (!product) return jsonError('المنتج غير موجود', 404);

    const newState = product.is_hidden ? 0 : 1;

    await env.DB.prepare(
      'UPDATE products SET is_hidden = ? WHERE id = ?'
    ).bind(newState, product_id).run();

    return new Response(JSON.stringify({ 
      ok: true, 
      is_hidden: newState,
      message: newState ? 'تم إخفاء المنتج' : 'تم إظهار المنتج'
    }), {
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
