export class SlidingWindow {
  private data: Map<number, number[]> = new Map();
  private windowSize: number;
  private bucketSize: number;

  constructor(windowSizeMs: number, bucketSizeMs: number = 1000) {
    this.windowSize = windowSizeMs;
    this.bucketSize = bucketSizeMs;
  }

  add(value: number, timestamp: number = Date.now()): void {
    const bucket = Math.floor(timestamp / this.bucketSize);
    if (!this.data.has(bucket)) {
      this.data.set(bucket, []);
    }
    this.data.get(bucket)!.push(value);
    this.cleanup(timestamp);
  }

  private cleanup(currentTime: number): void {
    const cutoff = Math.floor(
      (currentTime - this.windowSize) / this.bucketSize
    );
    for (const [bucket] of this.data) {
      if (bucket < cutoff) {
        this.data.delete(bucket);
      }
    }
  }

  getSum(timestamp: number = Date.now()): number {
    this.cleanup(timestamp);
    let sum = 0;
    for (const values of this.data.values()) {
      sum += values.reduce((a, b) => a + b, 0);
    }
    return sum;
  }

  getAverage(timestamp: number = Date.now()): number {
    const count = this.getCount(timestamp);
    return count > 0 ? this.getSum(timestamp) / count : 0;
  }

  getCount(timestamp: number = Date.now()): number {
    this.cleanup(timestamp);
    let count = 0;
    for (const values of this.data.values()) {
      count += values.length;
    }
    return count;
  }

  getMin(timestamp: number = Date.now()): number | null {
    this.cleanup(timestamp);
    let min: number | null = null;
    for (const values of this.data.values()) {
      for (const value of values) {
        if (min === null || value < min) {
          min = value;
        }
      }
    }
    return min;
  }

  getMax(timestamp: number = Date.now()): number | null {
    this.cleanup(timestamp);
    let max: number | null = null;
    for (const values of this.data.values()) {
      for (const value of values) {
        if (max === null || value > max) {
          max = value;
        }
      }
    }
    return max;
  }

  getPercentile(
    percentile: number,
    timestamp: number = Date.now()
  ): number | null {
    this.cleanup(timestamp);
    const allValues: number[] = [];
    for (const values of this.data.values()) {
      allValues.push(...values);
    }

    if (allValues.length === 0) return null;

    allValues.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * allValues.length) - 1;
    return allValues[index];
  }

  clear(): void {
    this.data.clear();
  }
}
