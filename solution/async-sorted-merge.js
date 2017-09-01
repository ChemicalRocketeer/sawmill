'use strict'

const Heap = require('heap');
const P = require('bluebird');
const queue = require('./queue');

const nextTick = P.promisify(process.nextTick);

const MAX_PREFETCH_DEPTH = 100;
// adjust this for how much space you want prefetched values to take up
const MAX_PREFETCH_SPACE = 1000000;
const SLOW_ALGO_THRESHOLD = 1000000;

module.exports = (logSources, printer) => {
	if (logSources.length >= SLOW_ALGO_THRESHOLD) return memoryEfficientSlowImplementation(logSources, printer);
	// heap of logs sorting by date, this is what actually merges the sources
	const logheap = new Heap((a, b) => a.log.date - b.log.date);
	// pushes the given log wrapper
	const pushToHeap = wrapper => wrapper && wrapper.log ? logheap.push(wrapper) : null;
	let error = null;
	let liveSourceCount = logSources.length;
	// how big is a log buffer allowed to get?
	const bufferMaxSize = () => Math.ceil(Math.min(MAX_PREFETCH_SPACE / liveSourceCount, MAX_PREFETCH_DEPTH));

	// initialize the heap and then start the sawmill
	return P.map(logSources, (logSource) => {
		// initialize the heap by pushing a log wrapper onto it for each source
		return BufferedSource(logSource).next().then(pushToHeap)
	})
	// now we know that the log heap is primed, start processing it
	.then(lumbermill)
	.then(() => printer.done())
	.catch(err => {
		error = err;
		throw err;
	})

	// actually combines the sources, printing all the logs in order
	function lumbermill() {
		if (error) throw error;
		if (logheap.empty()) return; // free at last!
		const oldest = logheap.pop();
		printer.print(oldest.log);
		// each log wrapper has a reference to its BufferedSource,
		// which can give us a new value to stick in the heap.
		// When a source drains, next() will return false which will not change the heap.
		// With no log wrappers in the heap referencing it, that source will be GC'd.
		// This implementation cleans up after itself by doing nothing!
		return oldest.source.next()
		.then(pushToHeap)
		.then(lumbermill)
	}

	function BufferedSource(logSource) {
		// a queue of log values buffered in advance to save time. Items take the form: { source, log }
		const buffer = queue();
		// only one popAsync promise per source can be active at a time, this is that one.
		let worker = null;

		const source = {
			next,
			isDrained: () => logSource.drained
		};
		return source;

		function next() {
			// if something is in the buffer, return that, otherwise wait to fetch it
			return (buffer.isEmpty() ? prefetch() : P.resolve()).then(buffer.deq)
		}

		// fulfills once there is a log in the buffer
		function prefetch() {
			// can't pop more than one log at a time
			if (worker) return worker;
			worker = logSource.popAsync()
			.then(log => {
				worker = null;
				buffer.enq({ source, log });
				// keep prefetching until the buffer is full (stop if there was an error)
				if (!error && bufferMaxSize() - buffer.size() > 0) {
					// don't return the promise, this should run in the background
					prefetch()
					.catch(err => {
						error = err;
					})
				}
			})
			return worker;
		}
	}
}


// This was the original implementation, it's super slow.
// Decided to just swap it in when there's a huge number of sources,
// since it would be a bad idea to allocate buffers in that case.
function memoryEfficientSlowImplementation(logSources, printer) {
	// heap of logs sorting by date
	const logheap = new Heap((a, b) => a.log.date - b.log.date);

	// initialize the heap and then start the sawmill
	return P.map(logSources, (source, index) => popLogSource(index))
	.then(printOldestLog)
	.then(() => printer.done())

	function printOldestLog() {
		if (logheap.empty()) return;
		const oldest = logheap.pop();
		printer.print(oldest.log);
		return popLogSource(oldest.index)
		.then(printOldestLog); // recurse!
	}

	// pops a log from the log source into the heap.
	function popLogSource(index) {
		return logSources[index].popAsync()
		.then(log => log ? logheap.push({ log, index }) : null)
	}
}
