import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';

import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let title: Title;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeoService);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);

    // Reset the head between tests so canonical + meta assertions
    // read the current state rather than the DOM accumulated from a
    // previous test.
    document.head
      .querySelectorAll('link[rel="canonical"]')
      .forEach((el) => el.remove());
    ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']
      .forEach((n) => meta.removeTag(`name="${n}"`));
    ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:site_name']
      .forEach((p) => meta.removeTag(`property="${p}"`));
  });

  it('sets document.title via Title service', () => {
    service.update({ title: 'Hello | Leartech' });
    expect(title.getTitle()).toBe('Hello | Leartech');
  });

  it('sets description + OG + Twitter tags from a single update() call', () => {
    service.update({
      title: 'Landing',
      description: 'A short description.',
      image: 'https://example.com/preview.png',
      url: 'https://example.com/landing',
      siteName: 'Leartech',
      ogType: 'website',
      twitterCard: 'summary_large_image',
    });

    expect(meta.getTag('name="description"')?.getAttribute('content'))
      .toBe('A short description.');
    expect(meta.getTag('property="og:title"')?.getAttribute('content')).toBe('Landing');
    expect(meta.getTag('property="og:description"')?.getAttribute('content'))
      .toBe('A short description.');
    expect(meta.getTag('property="og:type"')?.getAttribute('content')).toBe('website');
    expect(meta.getTag('property="og:url"')?.getAttribute('content'))
      .toBe('https://example.com/landing');
    expect(meta.getTag('property="og:image"')?.getAttribute('content'))
      .toBe('https://example.com/preview.png');
    expect(meta.getTag('property="og:site_name"')?.getAttribute('content'))
      .toBe('Leartech');
    expect(meta.getTag('name="twitter:card"')?.getAttribute('content'))
      .toBe('summary_large_image');
    expect(meta.getTag('name="twitter:title"')?.getAttribute('content')).toBe('Landing');
    expect(meta.getTag('name="twitter:description"')?.getAttribute('content'))
      .toBe('A short description.');
    expect(meta.getTag('name="twitter:image"')?.getAttribute('content'))
      .toBe('https://example.com/preview.png');
  });

  it('sets a canonical <link rel="canonical"> when url is present', () => {
    service.update({ title: 'x', url: 'https://example.com/foo' });
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/foo');
  });

  it('overwrites (not duplicates) the canonical link on subsequent updates', () => {
    service.update({ url: 'https://example.com/a' });
    service.update({ url: 'https://example.com/b' });
    const links = document.head.querySelectorAll('link[rel="canonical"]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://example.com/b');
  });

  it('removes the canonical link when setCanonicalUrl(undefined) is called', () => {
    service.update({ url: 'https://example.com/a' });
    service.setCanonicalUrl(undefined);
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('LEAVES tags alone when route data does not set them (undefined = no-op)', () => {
    // Pre-populate with a site-wide default the way index.html would.
    meta.updateTag({ property: 'og:site_name', content: 'Site Default' });
    // Route only overrides title + description — should not touch site name.
    service.update({ title: 'Route Page', description: 'route desc' });
    expect(meta.getTag('property="og:site_name"')?.getAttribute('content'))
      .toBe('Site Default');
  });

  it('REMOVES a tag when the field is explicitly the empty string', () => {
    meta.updateTag({ property: 'og:site_name', content: 'Site Default' });
    service.update({ siteName: '' });
    expect(meta.getTag('property="og:site_name"')).toBeNull();
  });

  it('honours a custom ogType + twitterCard override', () => {
    service.update({
      title: 'Blog post',
      ogType: 'article',
      twitterCard: 'summary',
    });
    expect(meta.getTag('property="og:type"')?.getAttribute('content')).toBe('article');
    expect(meta.getTag('name="twitter:card"')?.getAttribute('content')).toBe('summary');
  });

  it('reports isRunningInBrowser() true under the Karma platform', () => {
    expect(service.isRunningInBrowser()).toBeTrue();
  });
});
