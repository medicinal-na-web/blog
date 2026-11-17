/**
 * Medicinal Blog — data client
 *
 * Content (articles, products, categories) is read from Supabase via PostgREST
 * with the anon key, which only sees published rows (RLS). Layout and site
 * settings come from static JSON exported from the former Brasa CMS
 * (src/data/cms). Same API surface as the old CMS SDK, so pages and sections
 * did not change.
 */

import pagesData from "@/data/cms/pages.json";
import settingsData from "@/data/cms/settings.json";
import globalSectionsData from "@/data/cms/global-sections.json";
import authorsData from "@/data/cms/authors.json";
import campanhasData from "@/data/cms/campanhas.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionBlock = {
  id: string;
  component: string;
  props: Record<string, unknown>;
  loaderData?: unknown;
  deferred?: boolean;
  hidden?: boolean;
};

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverUrl: string | null;
  status: string;
  featured: boolean;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  secondaryKeywords: string | null;
  seoScore: number | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  schemaType: string | null;
  canonicalUrl: string | null;
  wordCount: number | null;
  noindex: boolean | null;
  nofollow: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  category: { id: number; name: string; slug: string } | null;
  author: {
    id: number;
    name: string;
    slug: string;
    bio: string | null;
    avatar: { url: string } | null;
  } | null;
  heroImage: {
    url: string | null;
    alt: string | null;
    sizes?: {
      thumbnail?: { url: string | null };
      card?: { url: string | null };
      hero?: { url: string | null };
    };
  } | null;
  tags: { tag: string }[];
};

/** Post without content — returned by list endpoints */
export type PostListItem = Omit<
  Post,
  | "content"
  | "metaTitle"
  | "metaDescription"
  | "focusKeyword"
  | "ogTitle"
  | "ogDescription"
  | "ogImageUrl"
  | "schemaType"
  | "canonicalUrl"
  | "wordCount"
  | "noindex"
  | "nofollow"
  | "createdAt"
  | "updatedAt"
>;

export type PaginatedResult<T> = {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  postCount?: number;
};

export type Author = {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  avatar: { url: string } | null;
};

export type AuthorWithPosts = {
  author: Author;
  docs: PostListItem[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type SiteSettings = {
  siteName: string | null;
  siteDescription: string | null;
  logo: { url: string; alt: string | null } | null;
  favicon: { url: string } | null;
  whatsapp: string | null;
  social: {
    facebook: string | null;
    instagram: string | null;
    youtube: string | null;
  };
  newsletter: {
    title: string | null;
    description: string | null;
    consent: string | null;
  };
  seo: {
    title: string | null;
    description: string | null;
    keywords: string | null;
  };
  footerText: string | null;
  copyrightText: string | null;
  analytics: {
    umamiWebsiteId: string | null;
    umamiUrl: string | null;
    gtmId: string | null;
    ga4Id: string | null;
    googleAdsId: string | null;
    facebookPixelId: string | null;
  };
  scripts: {
    head: string | null;
    body: string | null;
  };
};

export type CmsPage = {
  id: number;
  slug: string;
  title: string;
  content: string | null;
  sections: SectionBlock[] | null;
  draftSections: SectionBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  isKit: boolean | null;
  featured: boolean | null;
  publishedAt: string | null;
  category: { id: number; name: string; slug: string } | null;
  image: { url: string; alt: string | null; thumbnailUrl: string | null } | null;
};

export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  sortOrder: number | null;
  image: { url: string; alt: string | null; thumbnailUrl: string | null } | null;
};

// ---------------------------------------------------------------------------
// Revalidation constants (seconds)
// ---------------------------------------------------------------------------

const REVALIDATE = {
  POSTS_LIST: 60,
  POST_SINGLE: 60,
  CATEGORIES: 300,
  PRODUCTS: 300,
} as const;

// ---------------------------------------------------------------------------
// Static data exported from the former Brasa CMS (layout and settings).
// Content (articles, products, categories) lives in Supabase.
// ---------------------------------------------------------------------------


const STATIC_PAGES = pagesData as unknown as CmsPage[];
const STATIC_AUTHORS = authorsData as Author[];
const STATIC_COLLECTIONS: Record<string, CollectionItem[]> = {
  campanhas: campanhasData as CollectionItem[],
};

type CollectionItem = {
  id: number;
  slug: string;
  status: string;
  data: Record<string, unknown>;
};

type GlobalSection = { id: string; component: string; props: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Supabase PostgREST client
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function createSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

  /** Runs a PostgREST query. Returns rows and the exact total (when requested). */
  async function query<T = Row>(
    table: string,
    params: URLSearchParams,
    opts?: { revalidate?: number; count?: boolean; tag?: string },
  ): Promise<{ rows: T[]; total: number }> {
    if (!url || !key) {
      console.error("[cms] SUPABASE_URL / SUPABASE_ANON_KEY nao configuradas");
      return { rows: [], total: 0 };
    }
    try {
      const res = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          ...(opts?.count ? { Prefer: "count=exact" } : {}),
        },
        next: { revalidate: opts?.revalidate ?? 60, tags: [opts?.tag ?? table] },
      });
      if (!res.ok) {
        console.error(`[cms] ${res.status} ${res.statusText} — ${table}`);
        return { rows: [], total: 0 };
      }
      const rows = (await res.json()) as T[];
      const range = res.headers.get("content-range");
      const total = range ? Number(range.split("/")[1]) || rows.length : rows.length;
      return { rows, total };
    } catch (error) {
      console.error(`[cms] Fetch failed — ${table}`, error);
      return { rows: [], total: 0 };
    }
  }

  return { query };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

function authorFor(name: string | null): Post["author"] {
  if (!name) return null;
  const known = STATIC_AUTHORS.find((a) => a.name === name);
  return known ?? { id: 0, name, slug: "", bio: null, avatar: null };
}

function mapCategory(r: Row): Post["category"] {
  const c = r.categories as { id: number; name: string; slug: string } | null | undefined;
  return c ? { id: c.id, name: c.name, slug: c.slug } : null;
}

function mapPost(r: Row): Post {
  const cover = str(r.cover_image_url);
  const tags = (r.article_tags as { tags: { name: string } | null }[] | undefined) ?? [];
  return {
    id: r.id as number,
    title: r.title as string,
    slug: r.slug as string,
    excerpt: str(r.excerpt),
    content: str(r.content),
    coverUrl: cover,
    status: str(r.status) ?? "published",
    featured: Boolean(r.featured),
    publishedAt: str(r.published_date) ?? str(r.published_at),
    readingTimeMinutes: num(r.reading_time_minutes),
    metaTitle: str(r.meta_title),
    metaDescription: str(r.meta_description),
    focusKeyword: str(r.focus_keyword),
    secondaryKeywords: Array.isArray(r.secondary_keywords)
      ? (r.secondary_keywords as string[]).join(", ")
      : str(r.secondary_keywords),
    seoScore: num(r.seo_score),
    ogTitle: str(r.og_title),
    ogDescription: str(r.og_description),
    ogImageUrl: str(r.og_image_url),
    schemaType: str(r.schema_type),
    canonicalUrl: str(r.canonical_url),
    wordCount: num(r.word_count),
    noindex: null,
    nofollow: null,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    category: mapCategory(r),
    author: authorFor(str(r.author_name)),
    heroImage: cover
      ? {
          url: cover,
          alt: str(r.cover_image_alt),
          sizes: { thumbnail: { url: cover }, card: { url: cover }, hero: { url: cover } },
        }
      : null,
    tags: tags.filter((t) => t.tags).map((t) => ({ tag: t.tags!.name })),
  };
}

function mapProduct(r: Row): Product & Record<string, unknown> {
  const cover = str(r.cover_image_url);
  const content = str(r.content);
  return {
    id: r.id as number,
    name: str(r.title) ?? "",
    slug: r.slug as string,
    description: str(r.excerpt),
    brand: null,
    isKit: null,
    featured: null,
    publishedAt: str(r.published_at),
    category: mapCategory(r),
    image: cover ? { url: cover, alt: str(r.cover_image_alt), thumbnailUrl: null } : null,
    // Extended fields used by the product detail page
    content: content ? { _html: content } : null,
    faq: r.faq || [],
    embalagem_mockup: r.embalagem_mockup || null,
    redirect_to: r.redirect_to || null,
    metaTitle: str(r.meta_title),
    metaDescription: str(r.meta_description),
    seoDescription: str(r.meta_description),
    ogTitle: str(r.og_title),
    ogDescription: str(r.og_description),
    ogImageUrl: str(r.og_image_url),
    focusKeyword: str(r.focus_keyword),
    secondaryKeywords: r.secondary_keywords || null,
    schemaType: str(r.schema_type),
    canonicalUrl: str(r.canonical_url),
    wordCount: num(r.word_count),
    readingTimeMinutes: num(r.reading_time_minutes),
    recommendationTags: r.recommendation_tags || [],
  };
}

const POST_LIST_SELECT =
  "id,title,slug,excerpt,cover_image_url,cover_image_alt,status,featured,published_date,published_at,reading_time_minutes,author_name,categories(id,name,slug)";

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function createClient() {
  const sb = createSupabase();

  // -------------------------------------------------------------------------
  // Posts (Supabase: articles)
  // -------------------------------------------------------------------------

  const posts = {
    async list(
      opts?: {
        limit?: number;
        page?: number;
        category?: string;
        author?: number | string;
        featured?: boolean;
        homeSection?: string;
        search?: string;
        draft?: boolean;
      },
    ): Promise<PaginatedResult<PostListItem>> {
      const { limit = 10, page = 1, category, author, featured, homeSection, search } = opts ?? {};

      const params = new URLSearchParams({
        status: "eq.published",
        order: "published_date.desc.nullslast,published_at.desc.nullslast,id.desc",
        limit: String(limit),
        offset: String((page - 1) * limit),
      });
      let select = POST_LIST_SELECT;
      if (category) {
        select = select.replace("categories(", "categories!inner(");
        params.set("categories.slug", `eq.${category}`);
      }
      params.set("select", select);
      if (featured) params.set("featured", "is.true");
      if (homeSection) params.set("home_section", `eq.${homeSection}`);
      if (search) {
        const term = search.replace(/[%,()*]/g, " ").trim();
        params.set("or", `(title.ilike.*${term}*,excerpt.ilike.*${term}*)`);
      }
      if (author !== undefined) {
        const a = STATIC_AUTHORS.find((x) => x.id === Number(author) || x.slug === String(author));
        if (a) params.set("author_name", `eq.${a.name}`);
      }

      const { rows, total } = await sb.query("articles", params, {
        revalidate: search ? 0 : REVALIDATE.POSTS_LIST,
        count: true,
        tag: "posts",
      });
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return {
        docs: rows.map(mapPost),
        totalDocs: total,
        totalPages,
        page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    },

    async getBySlug(slug: string, _opts?: { draft?: boolean }): Promise<Post | null> {
      const params = new URLSearchParams({
        slug: `eq.${slug}`,
        status: "eq.published",
        select: "*,categories(id,name,slug),article_tags(tags(name))",
        limit: "1",
      });
      const { rows } = await sb.query("articles", params, {
        revalidate: REVALIDATE.POST_SINGLE,
        tag: "posts",
      });
      return rows[0] ? mapPost(rows[0]) : null;
    },

    async featured(_opts?: { draft?: boolean }): Promise<PostListItem | null> {
      const result = await posts.list({ limit: 1, featured: true });
      if (result.docs[0]) return result.docs[0];
      const recent = await posts.list({ limit: 1 });
      return recent.docs[0] ?? null;
    },
  };

  // -------------------------------------------------------------------------
  // Categories (Supabase: categories)
  // -------------------------------------------------------------------------

  const categories = {
    async list(opts?: { withCount?: boolean }): Promise<{ docs: Category[] }> {
      const select = opts?.withCount
        ? "id,name,slug,description,articles(count)"
        : "id,name,slug,description";
      const params = new URLSearchParams({ select, order: "name.asc" });
      if (opts?.withCount) params.set("articles.status", "eq.published");
      const { rows } = await sb.query("categories", params, {
        revalidate: REVALIDATE.CATEGORIES,
        tag: "categories",
      });
      return {
        docs: rows.map((r) => ({
          id: r.id as number,
          name: r.name as string,
          slug: r.slug as string,
          description: str(r.description),
          ...(opts?.withCount
            ? { postCount: ((r.articles as { count: number }[] | undefined)?.[0]?.count ?? 0) }
            : {}),
        })),
      };
    },

    async getBySlug(slug: string): Promise<Category | null> {
      const { docs } = await categories.list();
      return docs.find((c) => c.slug === slug) ?? null;
    },
  };

  // -------------------------------------------------------------------------
  // Authors (static: one editorial author)
  // -------------------------------------------------------------------------

  const authors = {
    async getBySlug(
      slug: string,
      opts?: { limit?: number; page?: number },
    ): Promise<AuthorWithPosts | null> {
      const author = STATIC_AUTHORS.find((a) => a.slug === slug);
      if (!author) return null;
      const result = await posts.list({ ...opts, limit: opts?.limit ?? 12, author: author.id });
      return {
        author,
        docs: result.docs,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        page: result.page,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      };
    },
  };

  // -------------------------------------------------------------------------
  // Settings, pages, collections, global sections (static)
  // -------------------------------------------------------------------------

  const settings = {
    async get(): Promise<SiteSettings> {
      return settingsData as unknown as SiteSettings;
    },
  };

  const pages = {
    async get(slug: string, opts?: { draft?: boolean }): Promise<CmsPage | null> {
      const page = STATIC_PAGES.find((p) => p.slug === slug);
      if (!page) return null;
      if (opts?.draft && page.draftSections) return { ...page, sections: page.draftSections };
      return page;
    },
  };

  const collections = {
    async list(
      slug: string,
      opts?: { limit?: number; offset?: number },
    ): Promise<{ docs: CollectionItem[] }> {
      const { limit = 50, offset = 0 } = opts ?? {};
      const items = STATIC_COLLECTIONS[slug] ?? [];
      return { docs: items.slice(offset, offset + limit) };
    },
  };

  const globalSections = {
    async get(): Promise<{ header?: GlobalSection | null; footer?: GlobalSection | null }> {
      return globalSectionsData as { header?: GlobalSection | null; footer?: GlobalSection | null };
    },
  };

  // -------------------------------------------------------------------------
  // Products (Supabase: products, product_categories)
  // -------------------------------------------------------------------------

  const products = {
    async list(
      opts?: {
        limit?: number;
        offset?: number;
        category?: number;
        featured?: boolean;
        search?: string;
      },
    ): Promise<{ docs: Product[] }> {
      const { limit = 20, offset = 0, category, search } = opts ?? {};
      const params = new URLSearchParams({
        status: "eq.published",
        select: "id,title,slug,excerpt,cover_image_url,cover_image_alt,published_at,categories(id,name,slug)",
        order: "title.asc",
        limit: String(limit),
        offset: String(offset),
      });
      if (category !== undefined) params.set("category_id", `eq.${category}`);
      if (search) {
        const term = search.replace(/[%,()*]/g, " ").trim();
        params.set("or", `(title.ilike.*${term}*,excerpt.ilike.*${term}*)`);
      }
      const { rows } = await sb.query("products", params, {
        revalidate: search ? 0 : REVALIDATE.PRODUCTS,
        tag: "products",
      });
      return { docs: rows.map(mapProduct) };
    },

    async getBySlug(slug: string): Promise<Product | null> {
      const params = new URLSearchParams({
        slug: `eq.${slug}`,
        status: "eq.published",
        select: "*,categories(id,name,slug)",
        limit: "1",
      });
      const { rows } = await sb.query("products", params, {
        revalidate: REVALIDATE.PRODUCTS,
        tag: "products",
      });
      return rows[0] ? mapProduct(rows[0]) : null;
    },
  };

  const productCategories = {
    async list(): Promise<{ docs: ProductCategory[] }> {
      const params = new URLSearchParams({
        select: "id,name,slug,description,image_url,sort_order",
        order: "sort_order.asc.nullslast,name.asc",
      });
      const { rows } = await sb.query("product_categories", params, {
        revalidate: REVALIDATE.CATEGORIES,
      });
      return {
        docs: rows.map((r) => ({
          id: r.id as number,
          name: r.name as string,
          slug: r.slug as string,
          description: str(r.description),
          parentId: null,
          sortOrder: num(r.sort_order),
          image: str(r.image_url)
            ? { url: r.image_url as string, alt: r.name as string, thumbnailUrl: null }
            : null,
        })),
      };
    },
  };

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    posts,
    categories,
    authors,
    settings,
    pages,
    products,
    productCategories,
    collections,
    globalSections,
  };
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const cms = createClient();
