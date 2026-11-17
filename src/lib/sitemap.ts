import { cms } from "@/lib/cms";
import pagesData from "@/data/cms/pages.json";
import { getSiteUrl } from "@/lib/utils";

type Entry = { loc: string; lastmod?: string | null };

const SITEMAPS = ["posts", "produtos", "categorias", "paginas"] as const;
const SKIP_PAGES = new Set(["home", "search"]);

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function lastmod(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : `<lastmod>${date.toISOString()}</lastmod>`;
}

function urlset(entries: Entry[]) {
  const body = entries
    .map((e) => `  <url><loc>${xmlEscape(e.loc)}</loc>${lastmod(e.lastmod)}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

async function entriesFor(type: string, site: string): Promise<Entry[]> {
  switch (type) {
    case "posts": {
      const { docs } = await cms.posts.list({ limit: 1000 });
      return docs.map((p) => ({ loc: `${site}/posts/${p.slug}`, lastmod: p.publishedAt }));
    }
    case "produtos": {
      const { docs } = await cms.products.list({ limit: 1000 });
      return docs.map((p) => ({ loc: `${site}/${p.slug}/p`, lastmod: p.publishedAt }));
    }
    case "categorias": {
      const { docs } = await cms.categories.list();
      return docs.map((c) => ({ loc: `${site}/categorias/${c.slug}` }));
    }
    case "paginas": {
      const pages = (pagesData as { slug: string }[])
        .filter((p) => !SKIP_PAGES.has(p.slug))
        .map((p) => ({ loc: `${site}/${p.slug}` }));
      return [{ loc: `${site}/` }, ...pages];
    }
    default:
      return [];
  }
}

/** Builds the sitemap XML from Supabase content and the static pages. */
export async function fetchSitemapXml(type: string): Promise<Response> {
  const site = getSiteUrl();
  const headers = { "Content-Type": "application/xml" };

  if (type === "index") {
    const body = SITEMAPS.map((s) => `  <sitemap><loc>${site}/sitemaps/${s}.xml</loc></sitemap>`).join("\n");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`,
      { headers },
    );
  }

  return new Response(urlset(await entriesFor(type, site)), { headers });
}
