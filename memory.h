#ifndef clox_memory_h
#define clox_memory_h

#include "common.h"

#define GROW_CAPACITY(oldCapacity) oldCapacity < 8 ? 8 : (oldCapacity * 2)

#define GROW_ARRAY(type, pointer, oldCapacity, newCapacity) \
  (type *)reallocate(pointer, sizeof(type) * oldCapacity, sizeof(type) * newCapacity)

#define FREE_ARRAY(type, pointer, capacity) \
  reallocate(pointer, sizeof(type) * capacity, 0)

void * reallocate(void *pointer, size_t oldSizeInBytes, size_t newSizeInBytes);

#endif
