#ifndef THISTLE_SMOKE_IO_H
#define THISTLE_SMOKE_IO_H

static inline long wr(int fd, const void *p, unsigned long n) {
  register long a0 asm("a0") = fd;
  register const void *a1 asm("a1") = p;
  register unsigned long a2 asm("a2") = n;
  register long a7 asm("a7") = 64;
  asm volatile("ecall" : "+r"(a0) : "r"(a1), "r"(a2), "r"(a7) : "memory");
  return a0;
}

#endif
