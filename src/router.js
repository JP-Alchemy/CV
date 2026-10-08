// Hash routes work on any static host without rewrite rules.
//   #/            home
//   #/work        project index
//   #/work/:slug  project
//   #/about, #/cv, #/contact

export function parseRoute(hash = location.hash) {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home', path: '/' };
  if (parts[0] === 'work' && parts[1]) return { name: 'project', slug: parts[1], path };
  if (['work', 'about', 'cv', 'contact'].includes(parts[0]) && parts.length === 1) return { name: parts[0], path };
  return { name: 'notFound', path };
}
