import { Injectable, inject } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { SeoService, SeoTags } from './seo.service';

/**
 * Route `data` keys this strategy consumes:
 *
 *   title       — page title (rendered inside `<title>` + used for
 *                 `og:title` / `twitter:title`)
 *   description — page description (`<meta name="description">`,
 *                 `og:description`, `twitter:description`)
 *   image       — absolute URL of a social-preview image
 *                 (`og:image` + `twitter:image`)
 *   ogType      — Open Graph type (default `website`)
 *   twitterCard — Twitter card style (default `summary_large_image`)
 *
 * Consuming routes look like:
 *
 *   {
 *     path: 'about',
 *     loadComponent: () => import('./about/about.component').then(m => m.AboutComponent),
 *     data: {
 *       title: 'About | Leartech',
 *       description: 'How the Leartech platform is built.',
 *     },
 *   }
 *
 * A global site name + canonical URL come from route data OR
 * (preferred) are picked up from the static `index.html` defaults +
 * the chart-driven `__CANONICAL_HOST__` placeholder that the runtime
 * server rewrites at deploy time.
 */
interface AppRouteData {
  title?: string;
  description?: string;
  image?: string;
  ogType?: string;
  twitterCard?: string;
  siteName?: string;
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly seo = inject(SeoService);

  override updateTitle(routerState: RouterStateSnapshot): void {
    const routeData = this.collectRouteData(routerState);
    const title = this.buildTitle(routerState) ?? routeData.title;

    // Compose the full tag bundle from route data + resolved title.
    const tags: SeoTags = {
      title,
      description: routeData.description,
      image: routeData.image,
      ogType: routeData.ogType,
      twitterCard: routeData.twitterCard,
      siteName: routeData.siteName,
      url: routeData.url,
    };

    this.seo.update(tags);
  }

  /**
   * Walk the activated route tree and collect the deepest-defined
   * SEO-relevant `data` fields. Deeper (child) routes override their
   * parents so nested layouts can set defaults and leaf routes fill
   * in the specifics.
   */
  private collectRouteData(routerState: RouterStateSnapshot): AppRouteData {
    const out: AppRouteData = {};
    let node = routerState.root;
    while (node) {
      const data = node.data as AppRouteData | undefined;
      if (data) {
        if (data.title !== undefined) out.title = data.title;
        if (data.description !== undefined) out.description = data.description;
        if (data.image !== undefined) out.image = data.image;
        if (data.ogType !== undefined) out.ogType = data.ogType;
        if (data.twitterCard !== undefined) out.twitterCard = data.twitterCard;
        if (data.siteName !== undefined) out.siteName = data.siteName;
        if (data.url !== undefined) out.url = data.url;
      }
      const [first] = node.children;
      if (!first) break;
      node = first;
    }
    return out;
  }
}
