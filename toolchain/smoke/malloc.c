#include <stdlib.h>
#include <unistd.h>

int main(void) {
  char *p = malloc(256);
  if (!p) return 2;
  p[0] = 'O'; p[1] = 'K'; p[2] = '\n';
  int rc = write(1, p, 3) == 3 ? 0 : 3;
  free(p);
  return rc;
}
