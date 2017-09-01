'use strict'

const MAX_PREFETCH_DEPTH = 100;
const MAX_PREFETCH_SPACE = 200000;
let liveSourceCount = 10;

const prefetchMaxSize = () => Math.ceil(Math.min(MAX_PREFETCH_SPACE / liveSourceCount, MAX_PREFETCH_DEPTH));


let size = prefetchMaxSize()
let area = size * liveSourceCount

size
area