#include <stdio.h>
#include "debug.h"
#include "chunk.h"

static int simpleInstruction(const char *name, int offset) {
  printf("%s\n", name);
  return offset + 1;
}

static int constantInstruction(const char *name, Chunk *chunk, int offset) {
  int constant = (int)chunk->code[offset + 1];
  printf("%-16s %4d '", name, constant);
  printValue(chunk->constants.values[constant]);
  printf("'\n");
  return offset + 2;
}

void disassembleChunk(Chunk *chunk, const char *label) {
  printf("== %s ==\n", label);

  for (int offset = 0; offset < chunk->count; ) {
    offset = disassembleInstruction(chunk, offset);
  }
}

int disassembleInstruction(Chunk *chunk, int offset) {
  printf("%04d ", offset);
  OpCode instruction = chunk->code[offset];
  if (offset > 0 && chunk->lines[offset] == chunk->lines[offset - 1]) {
    printf("   | ");
  } else {
    printf("%4d ", chunk->lines[offset]);
  }
  switch (instruction) {
    case OP_RETURN:
      return simpleInstruction("OP_RETURN", offset);
    case OP_CONSTANT:
      return constantInstruction("OP_CONSTANT", chunk, offset);
    default:
      printf("UNKNOWN INSTRUCTION %d\n", instruction);
      offset += 1;
  }
  return offset;
}
