// Real paths (good for search engines and sharing). Every route is
// prerendered to its own index.html at build time, so deep links work on any
// static host; unknown paths fall through to 404.html.
//   /                home
//   /work/           project index
//   /work/:slug/     project
//   /services/, /about/, /cv/, /contact/

export const PAGES = ['work', 'services', 'about', 'cv', 'contact'];

export function parseRoute(pathname = location.pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home', path: '/' };
  if (parts[0] === 'work' && parts.length === 2) return { name: 'project', slug: parts[1], path: `/work/${parts[1]}/` };
  if (PAGES.includes(parts[0]) && parts.length === 1) return { name: parts[0], path: `/${parts[0]}/` };
  return { name: 'notFound', path: `/${parts.join('/')}/` };
}

/** Old hash links (#/work) from the first version of this site. */
export function fromHash(hash = location.hash) {
  return hash.startsWith('#/') ? hash.slice(1).replace(/\/?$/, '/') : null;
}
