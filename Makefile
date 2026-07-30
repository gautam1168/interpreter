CC = clang
CFLAGS = -fsanitize=address,undefined -g -O0 -Wall -Wextra

clox: main.c
	$(CC) $(CFLAGS) -o clox main.c
