#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "vm.h"

static char * readFile(const char *filePath) {
  FILE *file = fopen(filePath, "rb");
  if (file == NULL) {
    printf("Could not open file at \"%s\".\n", filePath);
    exit(74);
  }

  fseek(file, 0L, SEEK_END);
  size_t fileSize = ftell(file);
  rewind(file);

  char *source = (char *)malloc(sizeof(char) * (fileSize + 1));
  if (source == NULL) {
    fprintf(stderr, "Not enough memory to read \"%s\".\n", filePath);
    exit(74);
  }

  size_t bytesRead = fread(source, sizeof(char), fileSize, file);
  source[fileSize] = '\0';
  fclose(file);
  if (bytesRead < fileSize) {
    printf("Couldn't read whole file\n");
    exit(74);
  }

  return source;
}

static void repl() {
  char line[1024];
  for (;;) {
    printf("> ");
    if (!fgets(line, sizeof(line), stdin)) {
      printf("\n");
      break;
    }
    interpret(line);
  }
}

static void runFile(const char *filePath) {
  char *source = readFile(filePath);
  InterpretResult result = interpret(source);
  free(source);

  if (result == INTERPRET_COMPILE_ERROR) exit(65);
  if (result == INTERPRET_RUNTIME_ERROR) exit(70);
}

int main(int argc, const char *argv[]) {
  initVM();
  if (argc == 1) {
    repl();
  } else if (argc == 2) {
    runFile(argv[1]);
  } else {
    fprintf(stderr, "Usage: clox [path]\n");
    exit(64);
  }
  freeVM();
  return 0;
}
