#define _GNU_SOURCE
#include <string.h>
#include <sys/mman.h>

int main(void)
{
  char *p = mmap(0, 4096, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  char *g = mmap(0, 4096, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (p == MAP_FAILED || g == MAP_FAILED) return 1;
  memcpy(p, "mremap keeps this", 18);
  char *q = mremap(p, 4096, 131072, MREMAP_MAYMOVE);
  if (q == MAP_FAILED || q == p || memcmp(q, "mremap keeps this", 18)) return 2;
  q[131071] = 42;
  if (g[0] || munmap(q, 131072) || munmap(g, 4096)) return 3;
  return 0;
}
