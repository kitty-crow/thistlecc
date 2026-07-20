#define _GNU_SOURCE
#include <errno.h>
#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

struct cfg {
  const char *bin;
  const char *arg[14];
  int n;
};

static const char *base(const char *s)
{
  const char *p = strrchr(s, '/');
  return p ? p + 1 : s;
}

static int run(char *const av[])
{
  pid_t p;
  int e = posix_spawn(&p, av[0], 0, 0, av, environ);
  if (e) {
    fprintf(stderr, "%s: %s\n", av[0], strerror(e));
    return 127;
  }
  int st;
  while (waitpid(p, &st, 0) < 0) if (errno != EINTR) {
    perror("waitpid");
    return 127;
  }
  if (WIFEXITED(st)) return WEXITSTATUS(st);
  return WIFSIGNALED(st) ? 128 + WTERMSIG(st) : 1;
}

static struct cfg tool(const char *n)
{
  struct cfg c = {0};
  if (!strcmp(n, "tcc")) {
    c.bin = "/usr/libexec/thistle/tcc";
  } else if (!strcmp(n, "clang") || !strcmp(n, "clang++")) {
    c.bin = !strcmp(n, "clang++") ? "/usr/libexec/thistle/clang++" : "/usr/libexec/thistle/clang";
    c.arg[c.n++] = "--target=riscv64-unknown-linux-musl";
    c.arg[c.n++] = "--sysroot=/";
    c.arg[c.n++] = "-march=rv64g";
    c.arg[c.n++] = "-mabi=lp64d";
    c.arg[c.n++] = "-mno-relax";
    c.arg[c.n++] = "-fuse-ld=lld";
    c.arg[c.n++] = "-resource-dir=/usr/lib/clang/22";
    c.arg[c.n++] = "--gcc-toolchain=/usr";
  } else if (!strcmp(n, "gcc") || !strcmp(n, "g++") || !strcmp(n, "cc") || !strcmp(n, "c++") || !strcmp(n, "cpp")) {
    int x = !strcmp(n, "g++") || !strcmp(n, "c++");
    c.bin = x ? "/usr/libexec/thistle/g++" : "/usr/libexec/thistle/gcc";
    c.arg[c.n++] = "-march=rv64g";
    c.arg[c.n++] = "-mabi=lp64d";
    c.arg[c.n++] = "-mno-relax";
    c.arg[c.n++] = "-B/usr/libexec/gcc/riscv64-unknown-linux-musl/16.1.0/";
    c.arg[c.n++] = "-B/usr/lib/gcc/riscv64-unknown-linux-musl/16.1.0/";
    c.arg[c.n++] = "-B/usr/libexec/thistle/gnu/";
    if (x) {
      c.arg[c.n++] = "-I/usr/include/c++/16.1.0";
      c.arg[c.n++] = "-I/usr/include/c++/16.1.0/riscv64-unknown-linux-musl";
      c.arg[c.n++] = "-I/usr/include/c++/16.1.0/backward";
    }
    if (!strcmp(n, "cpp")) c.arg[c.n++] = "-E";
  }
  return c;
}

static int stops(const char *s)
{
  return !strcmp(s, "-c") || !strcmp(s, "-S") || !strcmp(s, "-E") ||
    !strcmp(s, "-M") || !strcmp(s, "-MM") || !strcmp(s, "-fsyntax-only") ||
    !strcmp(s, "-emit-llvm") || !strcmp(s, "-r") || !strcmp(s, "-shared") ||
    !strcmp(s, "-run");
}

static int query(const char *s)
{
  return !strcmp(s, "--help") || !strcmp(s, "--version") || !strcmp(s, "-version") || !strcmp(s, "-dumpmachine") ||
    !strcmp(s, "-dumpversion") || !strcmp(s, "-dumpfullversion") || !strcmp(s, "-###") ||
    !strncmp(s, "-print-", 7);
}

int main(int ac, char **av)
{
  const char *name = base(av[0]);
  const char *triple = "riscv64-unknown-linux-musl-";
  if (!strncmp(name, triple, strlen(triple))) name += strlen(triple);
  struct cfg c = tool(name);
  if (!c.bin) {
    fprintf(stderr, "%s: no compiler is installed for this driver name\n", name);
    return 127;
  }

  int link = ac > 1, oi = -1, on = 0;
  const char *out = "a.out";
  for (int i = 1; i < ac; i++) {
    if (stops(av[i]) || query(av[i])) link = 0;
    if (!strcmp(av[i], "-o") && i + 1 < ac) { oi = i; on = 2; out = av[++i]; }
    else if (!strncmp(av[i], "-o", 2) && av[i][2]) { oi = i; on = 1; out = av[i] + 2; }
  }
  if (!strcmp(name, "cpp")) link = 0;
  if (ac == 2 && !strcmp(av[1], "-v")) link = 0;

  size_t cap = (size_t)ac + (size_t)c.n + 8;
  char **ca = calloc(cap, sizeof(*ca));
  if (!ca) { perror("calloc"); return 1; }
  int n = 0;
  ca[n++] = (char *)c.bin;
  for (int i = 0; i < c.n; i++) ca[n++] = (char *)c.arg[i];
  if (link) {
    ca[n++] = "-static";
    if (strcmp(name, "tcc")) ca[n++] = "-no-pie";
    if (!strcmp(name, "clang") || !strcmp(name, "clang++")) ca[n++] = "-Wl,--threads=1";
  }

  char tmp[128];
  if (link) snprintf(tmp, sizeof(tmp), "/tmp/.thx-cc-%ld.elf", (long)getpid());
  for (int i = 1; i < ac; i++) {
    if (link && i == oi) { i += on - 1; continue; }
    ca[n++] = av[i];
  }
  if (link) { ca[n++] = "-o"; ca[n++] = tmp; }
  ca[n] = 0;

  int rc = run(ca);
  free(ca);
  if (!link) return rc;
  if (rc) { unlink(tmp); return rc; }

  char *cv[] = { "/bin/elf2thx", "-o", (char *)out, tmp, 0 };
  rc = run(cv);
  if (unlink(tmp) && !rc) { perror(tmp); rc = 1; }
  return rc;
}
