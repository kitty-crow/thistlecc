#include "io.h"

class Out {
public:
  virtual long put(const char *p, unsigned long n) = 0;
  ~Out() = default;
};

class Term final : public Out {
public:
  long put(const char *p, unsigned long n) override { return wr(1, p, n); }
};

extern "C" int main(int argc, char **argv) {
  static const char msg[] = "Hello from GCC C++ in THX!\n";
  if (argc < 1 || !argv[0]) return 2;
  Term term;
  Out *out = &term;
  return out->put(msg, sizeof msg - 1) == sizeof msg - 1 ? 0 : 3;
}
