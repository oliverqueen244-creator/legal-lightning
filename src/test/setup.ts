import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship a window.matchMedia stub; some libs (next-themes,
// shadcn components) crash without it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// IntersectionObserver isn't in jsdom; many components use it for lazy-load.
class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = '';
  thresholds = [];
}
(globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }).IntersectionObserver = MockIntersectionObserver;
