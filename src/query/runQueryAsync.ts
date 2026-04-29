export function runQueryAsync<T>(job: () => T): Promise<T> {
  const delay = 150 + Math.round(Math.random() * 150);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(job());
    }, delay);
  });
}
