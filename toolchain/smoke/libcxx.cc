#include <iostream>
#include <string>
#include <vector>

class Msg {
public:
  virtual std::string text() const = 0;
  virtual ~Msg() = default;
};

class Hello final : public Msg {
public:
  std::string text() const override { return "Hello from libstdc++ C++ in THX!"; }
};

int main() {
  Hello h;
  const Msg &m = h;
  std::vector<std::string> v { m.text() };
  std::cout << v.front() << '\n';
}
