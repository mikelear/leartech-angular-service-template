import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AppTitleStrategy } from './app-title-strategy';
import { SeoService, SeoTags } from './seo.service';

/**
 * Build a minimal RouterStateSnapshot with a linear root -> child(?)
 * -> child(?) shape. Each level's `data` is applied in order — the
 * leaf overrides its parent. Return type deliberately widened so we
 * pass a plain-object graph into `updateTitle` without needing to
 * construct the full router internals.
 */
function makeRouterStateSnapshot(
  routeDataChain: Record<string, unknown>[],
  title?: string,
): RouterStateSnapshot {
  // Build the ActivatedRouteSnapshot chain from the leaf up.
  let child: unknown = null;
  for (let i = routeDataChain.length - 1; i >= 0; i--) {
    const node = {
      data: routeDataChain[i],
      children: child ? [child] : [],
      title,
    };
    child = node;
  }
  const rootSnapshot = child as unknown as ActivatedRouteSnapshot;
  return { root: rootSnapshot, url: '/', toString: () => '/' } as RouterStateSnapshot;
}

describe('AppTitleStrategy', () => {
  let strategy: AppTitleStrategy;
  let seoUpdates: SeoTags[];

  const seoStub: Pick<SeoService, 'update'> = {
    update: (tags: SeoTags) => {
      seoUpdates.push(tags);
    },
  };

  beforeEach(() => {
    seoUpdates = [];
    TestBed.configureTestingModule({
      providers: [
        AppTitleStrategy,
        { provide: SeoService, useValue: seoStub },
      ],
    });
    strategy = TestBed.inject(AppTitleStrategy);
  });

  it('emits title + description from route data', () => {
    const state = makeRouterStateSnapshot(
      [{}, { title: 'Home | Leartech', description: 'Landing description.' }],
      'Home | Leartech',
    );
    strategy.updateTitle(state);

    expect(seoUpdates.length).toBe(1);
    expect(seoUpdates[0].title).toBe('Home | Leartech');
    expect(seoUpdates[0].description).toBe('Landing description.');
  });

  it('lets child data override parent data', () => {
    const state = makeRouterStateSnapshot(
      [
        { title: 'Parent', description: 'parent desc' },
        { title: 'Child', description: 'child desc' },
      ],
      'Child',
    );
    strategy.updateTitle(state);
    expect(seoUpdates[0].title).toBe('Child');
    expect(seoUpdates[0].description).toBe('child desc');
  });

  it('carries image + ogType + twitterCard + siteName + url through untouched', () => {
    const state = makeRouterStateSnapshot(
      [{
        title: 'Blog: X',
        description: 'y',
        image: 'https://cdn.example.com/x.png',
        ogType: 'article',
        twitterCard: 'summary',
        siteName: 'Leartech',
        url: 'https://example.com/blog/x',
      }],
      'Blog: X',
    );
    strategy.updateTitle(state);
    const t = seoUpdates[0];
    expect(t.image).toBe('https://cdn.example.com/x.png');
    expect(t.ogType).toBe('article');
    expect(t.twitterCard).toBe('summary');
    expect(t.siteName).toBe('Leartech');
    expect(t.url).toBe('https://example.com/blog/x');
  });

  it('emits with undefined fields when route data is absent', () => {
    const state = makeRouterStateSnapshot([{}]);
    strategy.updateTitle(state);
    expect(seoUpdates.length).toBe(1);
    expect(seoUpdates[0].description).toBeUndefined();
    expect(seoUpdates[0].image).toBeUndefined();
  });
});
