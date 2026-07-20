#include "io.h"

int main(int argc, char **argv) {
  static const char msg[] = "Hello from GCC C in THX!\n";
  if (argc < 1 || !argv[0]) return 2;
  return wr(1, msg, sizeof msg - 1) == sizeof msg - 1 ? 0 : 3;
}
