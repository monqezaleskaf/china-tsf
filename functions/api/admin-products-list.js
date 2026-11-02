export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    // التحقق من كلمة المرور
    const authHeader = request.headers.get('X-Admin-Password') || '';
    const passRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'admin_password'"
    ).first();
    const correctPass = passRow ? passRow.value : '';

    if (!correctPass || authHeader !== correctPass) {
      return jsonError('كلمة المرور غير صحيحة', 401);
    }

    // جلب جميع المنتجات (بما فيها المخفية)
    const result = await env.DB.prepare(
      'SELECT id, name, brand, category, price, stock, image_url, is_hidden FROM products ORDER BY id ASC'
    ).all();

    return new Response(JSON.stringify({
      ok: true,
      products: result.results || []
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
