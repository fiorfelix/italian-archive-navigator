<?xml version="1.0" encoding="UTF-8"?>
<!-- Shows sitemap.xml as a readable page in browsers. Search engines ignore it. -->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat" />
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Sitemap · Italian Archive Navigator</title>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/styles.css?v=6" />
      </head>
      <body>
        <div class="tricolore"></div>
        <main>
          <h1>Sitemap</h1>
          <p class="lead">
            The <xsl:value-of select="count(s:urlset/s:url)" /> pages of
            <a href="/">Italian Archive Navigator</a> listed for search engines, with their
            other-language versions.
          </p>
          <table>
            <tr>
              <th>Page</th>
              <th>Other language</th>
              <th>Updated</th>
            </tr>
            <xsl:for-each select="s:urlset/s:url">
              <xsl:variable name="loc" select="s:loc" />
              <tr>
                <td><a href="{s:loc}"><xsl:value-of select="s:loc" /></a></td>
                <td>
                  <xsl:for-each select="xhtml:link[@hreflang != 'x-default' and @href != $loc]">
                    <a href="{@href}"><xsl:value-of select="@hreflang" /></a>
                  </xsl:for-each>
                </td>
                <td><xsl:value-of select="s:lastmod" /></td>
              </tr>
            </xsl:for-each>
          </table>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
