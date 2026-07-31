CC = clang
CFLAGS = -fsanitize=address,undefined -g -O0 -Wall -Wextra -Wno-unused-parameter
SRCS = $(wildcard *.c)

clox: $(SRCS)
	$(CC) $(CFLAGS) -o clox $(SRCS)

clean:
	rm -rf clox *.dSYM
