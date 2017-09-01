'use strict'

const Heap = require('heap');

module.exports = (logSources, printer) => {
	// heap of logs sorting by date
	const logheap = new Heap((a, b) => a.log.date - b.log.date);

	// initialize the heap
	logSources.forEach((source, index) => {
		const log = logSources[index].pop();
		if (log) logheap.push({ log, index });
	});

	while (!logheap.empty()) {
		const oldest = logheap.peek();
		printer.print(oldest.log);
		 // pop the next log from this source to ensure
		 // the oldest log from each source is always in the heap
		const log = logSources[oldest.index].pop();
		if (log) {
			// pushpop is faster than using push() and pop() sequentially
			logheap.pushpop({ log, index: oldest.index });
		} else {
			// if there's no new log we have nothing to push, so just pop it
			logheap.pop();
		}
	}

	printer.done();
}