'use strict'

// A linked queue. First-year CS, anyone?

module.exports = function queue() {
  let first;
  let last;
  let size = 0;
  return {
    enq: (data) => {
      let node = { data };
      if (!first) {
        first = node;
      } else if (last) {
        last.next = node;
      }
      last = node;
      size++;
    },
    deq: () => {
      if (!first) return null;
      let data = first.data;
      if (first === last) last = null;
      first = first.next;
      size--;
      return data;
    },
    peek: () =>  first ? first.data : null,
    size: () => size,
    isEmpty: () => !first
  }
}