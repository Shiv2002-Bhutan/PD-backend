
import pool from '../config/db.js'

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

const buildAbsoluteUrl = (base, value) => {
    if (!value) return ''

    try {
        return new URL(value, `${base}/`).href
    } catch {
        return ''
    }
}

export const getProductShare = async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query(
            `SELECT
                items.id,
                items.name,
                items.brand,
                items.sub_category,
                items.image_url,
                categories.name AS category
             FROM items
             LEFT JOIN categories
                ON categories.id = items.category_id
             WHERE items.id = $1`,
            [id]
        )

        const item = result.rows[0]

        if (!item) {
            return res.status(404).send('Product not found.')
        }

        const frontendBase = process.env.FRONTEND_URL
        const assetBase = process.env.PUBLIC_ASSET_BASE_URL

        if (!frontendBase || !assetBase) {
            console.error('Missing frontend or asset base URL configuration')
            return res.status(500).send(
                'Sharing is temporarily unavailable.'
            )
        }

        const productUrl = buildAbsoluteUrl(
            frontendBase,
            `/product/${item.id}`
        )

        const shareUrl = buildAbsoluteUrl(
            frontendBase,
            `/share/product/${item.id}`
        )

        const imageUrl = buildAbsoluteUrl(
            assetBase,
            item.image_url
        )

        const descriptionParts = [
            item.brand,
            item.category,
            item.sub_category,
            'PD Furniture'
        ].filter(Boolean)

        const title = escapeHtml(item.name)
        const description = escapeHtml(descriptionParts.join(' · '))

        const safeProductUrl = escapeHtml(productUrl)
        const safeShareUrl = escapeHtml(shareUrl)
        const safeImageUrl = escapeHtml(imageUrl)

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>${title} | PD Furniture</title>

    <meta name="description" content="${description}">

    <!-- Open Graph -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="PD Furniture">
    <meta property="og:url" content="${safeShareUrl}">

    ${imageUrl ? `
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:image:alt" content="${title}">
    <meta property="og:image:type" content="image/webp">
    ` : ''}

    <!-- Twitter / X -->
    <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">

    ${imageUrl ? `
    <meta name="twitter:image" content="${safeImageUrl}">
    ` : ''}

    <!-- Product page redirect -->
    <meta http-equiv="refresh" content="0;url=${safeProductUrl}">
    <link rel="canonical" href="${safeProductUrl}">
</head>

<body>
    <p>
        Redirecting to
        <a href="${safeProductUrl}">${title}</a>...
    </p>
</body>
</html>`

        res.set('Cache-Control', 'public, max-age=300')
        res.type('html').send(html)

    } catch (error) {
        console.error('Product share error:', error)
        res.status(500).send('Unable to load product.')
    }
}
