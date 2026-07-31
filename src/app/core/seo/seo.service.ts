import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * Per-page SEO tags this service knows how to set. Every field is
 * optional — the caller (usually `AppTitleStrategy`) fills what the
 * route's `data` gives it and the service updates the corresponding
 * tag(s) in the document `<head>`. Fields left undefined are LEFT
 * ALONE (so the site-wide defaults baked into `src/index.html` stand
 * for pages that don't override them).
 *
 * To explicitly REMOVE a tag on a given page (rare — usually you'd
 * override it), set the field to the empty string `""`.
 */
export interface SeoTags {
  /** Full page title. Rendered inside `<title>...</title>`. */
  title?: string;
  /**
   * Short (~155 char) page description. Drives
   * `<meta name="description">`, `og:description`, and
   * `twitter:description`.
   */
  description?: string;
  /** Absolute URL of an image used for social previews (OG + Twitter). */
  image?: string;
  /**
   * Absolute URL used as the canonical link + `og:url`. At build time
   * this will typically be a `__CANONICAL_HOST__` placeholder that the
   * static server rewrites via `envsubst` on container start to the
   * chart's `seo.canonicalHost`.
   */
  url?: string;
  /** Open Graph type. Defaults to 'website' when explicitly requested. */
  ogType?: string;
  /** Twitter card style. Defaults to 'summary_large_image' when set. */
  twitterCard?: string;
  /** Site name used for `og:site_name`. Set from a global site name. */
  siteName?: string;
}

/**
 * Sets per-page SEO tags: `<title>`, description, Open Graph, Twitter
 * card, and the canonical `<link>`. Safe to call during prerender
 * (SSG) — Angular's `Title` + `Meta` services are platform-agnostic;
 * the one `document`-touching path (canonical `<link>`) uses the
 * injected `DOCUMENT` token, so it also runs during SSR.
 *
 * Cloned services should NOT call this directly — register a
 * `TitleStrategy` (see `AppTitleStrategy`) that reads route `data`
 * and delegates here. That way `data: { title, description, image }`
 * on each route becomes the single source of truth for that route's
 * SEO tags.
 *
 * Fields NOT set by the route are LEFT ALONE — the site-wide
 * defaults from `src/index.html` stand. Set a field to the empty
 * string to explicitly remove a tag.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly documentRef = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Apply the given tags to the current document. Fields left
   * undefined leave the corresponding tag ALONE (defaults from
   * index.html stand). Fields set to the empty string are removed.
   */
  update(tags: SeoTags): void {
    const { title, description, image, url, ogType, twitterCard, siteName } = tags;

    if (title !== undefined && title !== '') {
      this.titleService.setTitle(title);
    }

    this.updateOrRemoveByName('description', description);
    this.updateOrRemoveByProperty('og:title', title);
    this.updateOrRemoveByProperty('og:description', description);
    this.updateOrRemoveByProperty('og:type', ogType);
    this.updateOrRemoveByProperty('og:url', url);
    this.updateOrRemoveByProperty('og:image', image);
    this.updateOrRemoveByProperty('og:site_name', siteName);
    this.updateOrRemoveByName('twitter:card', twitterCard);
    this.updateOrRemoveByName('twitter:title', title);
    this.updateOrRemoveByName('twitter:description', description);
    this.updateOrRemoveByName('twitter:image', image);

    // Canonical link — only update when a URL is explicitly provided.
    if (url !== undefined) {
      this.setCanonicalUrl(url === '' ? undefined : url);
    }
  }

  /**
   * Directly set the canonical `<link rel="canonical" href="...">` on
   * the current document. Passing `undefined` removes the tag.
   * Exposed as a public method so consumers can override the
   * canonical from outside the route data (e.g. for pages that alias
   * a canonical URL owned by another route).
   */
  setCanonicalUrl(url: string | undefined): void {
    const doc = this.documentRef;
    if (!doc) {
      return;
    }
    const head = doc.head;
    if (!head) {
      return;
    }
    let link = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      if (link) {
        link.remove();
      }
      return;
    }
    if (!link) {
      link = doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /**
   * Report whether the service is running in the browser (vs. during
   * prerender). Exposed for consumers that need to skip work on the
   * server (e.g. `document.title` reads for analytics).
   */
  isRunningInBrowser(): boolean {
    return this.isBrowser;
  }

  private updateOrRemoveByName(name: string, content: string | undefined): void {
    if (content === undefined) return;
    if (content === '') {
      this.metaService.removeTag(`name="${name}"`);
      return;
    }
    this.metaService.updateTag({ name, content });
  }

  private updateOrRemoveByProperty(property: string, content: string | undefined): void {
    if (content === undefined) return;
    if (content === '') {
      this.metaService.removeTag(`property="${property}"`);
      return;
    }
    this.metaService.updateTag({ property, content });
  }
}
