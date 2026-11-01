export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  // إذا لم يوجد ID، نعيد التوجيه للرئيسية
  if (!id) {
    return Response.redirect(url.origin, 302);
  }

  try {
    // جلب المنتج من قاعدة البيانات
    const product = await env.DB.prepare(
      'SELECT id, name, price, image_url FROM products WHERE id = ?'
    ).bind(id).first();

    if (!product) {
      return Response.redirect(url.origin, 302);
    }

    // تجهيز الصورة (إذا لم توجد صورة في القاعدة، نستخدم مسار الصور المحلي)
    const imagePath = product.image_url || `/images/products/${product.id}.png`;
    const imageUrl = `${url.origin}${imagePath}`;
    
    // تجهيز النص
    const title = product.name;
    const description = `شاهد ${product.name} على متجر الصين - شركة المستقبل الأقوى. السعر: $${product.price}`;
    const redirectUrl = `${url.origin}/?id=${product.id}`; // الرابط الذي سيفتح في المتصفح

    // بناء صفحة HTML خفيفة تحتوي على وسوم الميتا فقط (وتحول الزائر للمتجر)
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  
  <!-- وسوم المشاركة (Open Graph) -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${redirectUrl}">
  <meta property="og:type" content="product">
  
  <!-- وسوم تويتر -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- إعادة توجيه الزائر إلى المتجر -->
  <meta http-equiv="refresh" content="0; url=${redirectUrl}">
  <script>window.location.href = "${redirectUrl}";</script>
</head>
<body>
  <p>جاري تحويلك إلى المتجر... <a href="${redirectUrl}">اضغط هنا</a></p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err) {
    return Response.redirect(url.origin, 302);
  }
}
