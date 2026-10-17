/**
 * Prefix a site-internal path with the configured `base`, so links work both at
 * the domain root and under a GitHub Pages sub-path like /portfolio/.
 *   url('/')              -> '/portfolio/'
 *   url('records/baur/')  -> '/portfolio/records/baur/'
 *   url('/#all-projects') -> '/portfolio/#all-projects'
 */
export function url(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const rest = path.replace(/^\/+/, '');
  return `${base}/${rest}`;
}
