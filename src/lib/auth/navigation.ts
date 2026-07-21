export function sanitizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) {
    return '/';
  }

  if (!nextPath.startsWith('/')) {
    return '/';
  }

  if (nextPath.startsWith('//')) {
    return '/';
  }

  return nextPath;
}