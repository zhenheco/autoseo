<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <title>XML Sitemap - 1waySEO</title>
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
            max-width: 1400px;
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
          .table-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background: #f1f5f9;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            border-bottom: 2px solid #e2e8f0;
          }
          td {
            padding: 1rem;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
          }
          tr:hover {
            background: #f8fafc;
          }
          .url-cell {
            max-width: 500px;
          }
          .url-link {
            color: #0ea5e9;
            text-decoration: none;
            word-break: break-all;
            font-size: 0.9rem;
          }
          .url-link:hover {
            text-decoration: underline;
          }
          .lastmod {
            color: #64748b;
            font-size: 0.85rem;
            white-space: nowrap;
          }
          .priority {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .priority-high {
            background: #dcfce7;
            color: #166534;
          }
          .priority-medium {
            background: #fef9c3;
            color: #854d0e;
          }
          .priority-low {
            background: #f1f5f9;
            color: #64748b;
          }
          .changefreq {
            font-size: 0.85rem;
            color: #64748b;
          }
          .hreflang-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin-top: 0.5rem;
          }
          .hreflang-tag {
            display: inline-block;
            padding: 0.125rem 0.5rem;
            background: #e0f2fe;
            color: #0369a1;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 500;
          }
          .image-preview {
            width: 60px;
            height: 40px;
            object-fit: cover;
            border-radius: 4px;
            background: #f1f5f9;
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
            .stats {
              gap: 1rem;
            }
            th, td {
              padding: 0.75rem 0.5rem;
              font-size: 0.85rem;
            }
            .url-cell {
              max-width: 200px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>XML Sitemap</h1>
            <p class="subtitle">Generated by 1waySEO - AI-Powered SEO Content Platform</p>
            <div class="stats">
              <div class="stat">
                <div class="stat-value"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></div>
                <div class="stat-label">Total URLs</div>
              </div>
              <div class="stat">
                <div class="stat-value"><xsl:value-of select="count(sitemap:urlset/sitemap:url[image:image])"/></div>
                <div class="stat-label">With Images</div>
              </div>
              <div class="stat">
                <div class="stat-value"><xsl:value-of select="count(sitemap:urlset/sitemap:url[xhtml:link])"/></div>
                <div class="stat-label">Multi-language</div>
              </div>
            </div>
          </header>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>URL</th>
                  <th>Last Modified</th>
                  <th>Priority</th>
                  <th>Change Freq</th>
                  <th>Image</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:urlset/sitemap:url">
                  <xsl:sort select="sitemap:priority" order="descending"/>
                  <tr>
                    <td><xsl:value-of select="position()"/></td>
                    <td class="url-cell">
                      <a class="url-link" href="{sitemap:loc}">
                        <xsl:value-of select="sitemap:loc"/>
                      </a>
                      <xsl:if test="xhtml:link">
                        <div class="hreflang-tags">
                          <xsl:for-each select="xhtml:link">
                            <span class="hreflang-tag">
                              <xsl:value-of select="@hreflang"/>
                            </span>
                          </xsl:for-each>
                        </div>
                      </xsl:if>
                    </td>
                    <td class="lastmod">
                      <xsl:value-of select="substring(sitemap:lastmod, 1, 10)"/>
                    </td>
                    <td>
                      <xsl:variable name="priority" select="sitemap:priority"/>
                      <span>
                        <xsl:attribute name="class">
                          <xsl:text>priority </xsl:text>
                          <xsl:choose>
                            <xsl:when test="$priority >= 0.8">priority-high</xsl:when>
                            <xsl:when test="$priority >= 0.5">priority-medium</xsl:when>
                            <xsl:otherwise>priority-low</xsl:otherwise>
                          </xsl:choose>
                        </xsl:attribute>
                        <xsl:value-of select="sitemap:priority"/>
                      </span>
                    </td>
                    <td class="changefreq">
                      <xsl:value-of select="sitemap:changefreq"/>
                    </td>
                    <td>
                      <xsl:if test="image:image">
                        <img class="image-preview" src="{image:image/image:loc}" alt=""/>
                      </xsl:if>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>

          <footer>
            <p>This XML sitemap is generated by <a href="https://1wayseo.com">1waySEO</a></p>
            <p>Learn more about <a href="https://www.sitemaps.org/">XML Sitemaps</a></p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
