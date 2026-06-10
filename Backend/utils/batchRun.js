/**
 * Run an array of async task functions in sequential batches.
 * @param {Array<() => Promise<any>>} tasks - Array of async functions to run
 * @param {number} size - Batch size
 * @param {number} delayMs - Delay between batches in milliseconds
 * @returns {Promise<PromiseSettledResult[]>}
 */
const batchRun = async (tasks, size, delayMs = 1500) => {
  const results = [];
  for (let i = 0; i < tasks.length; i += size) {
    const batch = tasks.slice(i, i + size);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
    if (i + size < tasks.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
};

module.exports = { batchRun };
