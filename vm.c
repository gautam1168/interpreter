#include "chunk.h"
#include "debug.h"
#include "value.h"
#include "vm.h"
#include "compiler.h"
#include <stdio.h>

VM vm;

static void resetStack() {
  vm.stackTop = vm.stack;
}

void push(Value value) {
  *vm.stackTop = value;
  vm.stackTop += 1;
}

Value pop() {
  vm.stackTop -= 1;
  Value result = *vm.stackTop;
  return result;
}

void initVM() {
  resetStack();
}

void freeVM() {

}

uint8_t readByte() {
  uint8_t result = *vm.ip;
  vm.ip += 1;
  return result;
}

static InterpretResult run() {
#define READ_BYTE() *(vm.ip++)
#define READ_CONSTANT() vm.chunk->constants.values[READ_BYTE()]
#define BINARY_OP(op) do { \
  Value b = pop(); \
  Value a = pop(); \
  push(a op b);\
} while(false)

  for (;;) {
#ifdef DEBUG_TRACE_EXECUTION
    printf("           ");
    for (Value *slot = vm.stack; slot < vm.stackTop; ++slot) {
      printf("[");
      printValue(*slot);
      printf("]");
    }
    printf("\n");
    int offset = (int)(vm.ip - vm.chunk->code);
    disassembleInstruction(vm.chunk, offset);
#endif
    uint8_t instruction = READ_BYTE();
    switch (instruction) {
      case OP_RETURN:
      {
          Value result = pop();
          printValue(result);
          printf("\n");
          return INTERPRET_OK;
          break;
      }
      case OP_ADD: BINARY_OP(+); break;
      case OP_SUBTRACT: BINARY_OP(-); break;
      case OP_MULTIPLY: BINARY_OP(*); break;
      case OP_DIVIDE: BINARY_OP(/); break;
      case OP_NEGATE:
      {
        push(-pop());
        break;
      }
      case OP_CONSTANT:
      {
        Value constant = READ_CONSTANT();
        push(constant);
        break;
      }
    }
  }
#undef READ_BYTE
#undef READ_CONSTANT
#undef BINARY_OP
}

InterpretResult interpret(const char *source) {
  Chunk chunk;
  initChunk(&chunk);

  if (!compile(source, &chunk)) {
    freeChunk(&chunk);
    return INTERPRET_COMPILE_ERROR;
  }

  vm.chunk = &chunk;
  vm.ip = vm.chunk->code;

  InterpretResult result = run();
  freeChunk(&chunk);

  return result;
}
