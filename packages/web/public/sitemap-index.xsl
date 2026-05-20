<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <title>Sitemap Index - 1waySEO</title>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style type="text/css">
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f8fafc;
            color: #334155;
            line-height: 1.6;
            padding: 2rem;
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
          }
          header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
          }
          h1 {
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
          }
          .subtitle {
            color: #94a3b8;
            font-size: 0.95rem;
          }
          .stats {
            display: flex;
            gap: 2rem;
            margin-top: 1.5rem;
            flex-wrap: wrap;
          }
          .stat {
            background: rgba(255,255,255,0.1);
            padding: 0.75rem 1.25rem;
            border-radius: 8px;
          }
          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
          }
          .stat-label {
            font-size: 0.8rem;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .sitemap-grid {
            display: grid;
            gap: 1rem;
          }
          .sitemap-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            padding: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: box-shadow 0.2s, transform 0.2s;
          }
          .sitemap-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
          }
          .sitemap-info {
            flex: 1;
          }
          .sitemap-name {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0.25rem;
          }
          .sitemap-url {
            color: #0ea5e9;
            text-decoration: none;
            font-size: 0.9rem;
            word-break: break-all;
          }
          .sitemap-url:hover {
            text-decoration: underline;
          }
          .sitemap-meta {
            text-align: right;
          }
          .sitemap-lastmod {
            color: #64748b;
            font-size: 0.85rem;
          }
          .sitemap-type {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 0.5rem;
          }
          .type-post {
            background: #dcfce7;
            color: #166534;
          }
          .type-category {
            background: #e0f2fe;
            color: #0369a1;
          }
          .type-tag {
            background: #fef3c7;
            color: #92400e;
          }
          .type-page {
            background: #f3e8ff;
            color: #7c3aed;
          }
          footer {
            text-align: center;
            padding: 2rem;
            color: #94a3b8;
            font-size: 0.85rem;
          }
          footer a {
            color: #0ea5e9;
            text-decoration: none;
          }
          @media (max-width: 768px) {
            body {
              padding: 1rem;
            }
            .sitemap-card {
              flex-direction: column;
              align-items: flex-start;
              gap: 1rem;
            }
            .sitemap-meta {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>Sitemap Index</h1>
            <p class="subtitle">WordPress-style sitemap architecture by 1waySEO</p>
            <div class="stats">
              <div class="stat">
                <div class="stat-value"><xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)"/></div>
                <div class="stat-label">Sub-Sitemaps</div>
              </div>
            </div>
          </header>

          <div class="sitemap-grid">
            <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
              <div class="sitemap-card">
                <div class="sitemap-info">
                  <div class="sitemap-name">
                    <xsl:choose>
                      <xsl:when test="contains(sitemap:loc, 'post-sitemap')">Articles Sitemap</xsl:when>
                      <xsl:when test="contains(sitemap:loc, 'category-sitemap')">Categories Sitemap</xsl:when>
                      <xsl:when test="contains(sitemap:loc, 'tag-sitemap')">Tags Sitemap</xsl:when>
                      <xsl:when test="contains(sitemap:loc, 'page-sitemap')">Static Pages Sitemap</xsl:when>
                      <xsl:otherwise>Sitemap</xsl:otherwise>
                    </xsl:choose>
                  </div>
                  <a class="sitemap-url" href="{sitemap:loc}">
                    <xsl:value-of select="sitemap:loc"/>
                  </a>
                </div>
                <div class="sitemap-meta">
                  <div class="sitemap-lastmod">
                    Last modified: <xsl:value-of select="substring(sitemap:lastmod, 1, 10)"/>
                  </div>
                  <span>
                    <xsl:attribute name="class">
                      <xsl:text>sitemap-type </xsl:text>
                      <xsl:choose>
                        <xsl:when test="contains(sitemap:loc, 'post-sitemap')">type-post</xsl:when>
                        <xsl:when test="contains(sitemap:loc, 'category-sitemap')">type-category</xsl:when>
                        <xsl:when test="contains(sitemap:loc, 'tag-sitemap')">type-tag</xsl:when>
                        <xsl:when test="contains(sitemap:loc, 'page-sitemap')">type-page</xsl:when>
                        <xsl:otherwise>type-page</xsl:otherwise>
                      </xsl:choose>
                    </xsl:attribute>
                    <xsl:choose>
                      <xsl:when test="contains(sitemap:loc, 'post-sitemap')">POSTS</xsl:when>
                      <xsl:when test="contains(sitemap:loc, 'category-sitemap')">CATEGORIES</xsl:when>
                      <xsl:when test="contains(sitemap:loc, 'tag-sitemap')">TAGS</xsl:when>
                      <xsl:when test="contains(sitemap:loc, 'page-sitemap')">PAGES</xsl:when>
                      <xsl:otherwise>OTHER</xsl:otherwise>
                    </xsl:choose>
                  </span>
                </div>
              </div>
            </xsl:for-each>
          </div>

          <footer>
            <p>This sitemap index is generated by <a href="https://1wayseo.com">1waySEO</a></p>
            <p>Learn more about <a href="https://www.sitemaps.org/">XML Sitemaps</a></p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
