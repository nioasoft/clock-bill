/**
 * Performance Monitoring Utilities
 *
 * This file provides utilities for monitoring and optimizing app performance.
 */

/**
 * Marks the start of a performance measurement
 * Use with measurePerformance() to track operation timing
 */
export function markPerformanceStart(label: string) {
  if (typeof window !== 'undefined' && performance.mark) {
    performance.mark(`${label}-start`);
  }
}

/**
 * Marks the end of a performance measurement and logs the duration
 */
export function markPerformanceEnd(label: string) {
  if (typeof window !== 'undefined' && performance.mark && performance.measure) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    const measure = performance.getEntriesByName(label)[0];
    if (measure) {
      console.log(`[Performance] ${label}: ${measure.duration.toFixed(2)}ms`);

      // Clean up marks and measures
      performance.clearMarks(`${label}-start`);
      performance.clearMarks(`${label}-end`);
      performance.clearMeasures(label);
    }
  }
}

/**
 * Measures Core Web Vitals (LCP, FID, CLS)
 * Call this on page load to track performance metrics
 */
export function measureCoreWebVitals() {
  if (typeof window === 'undefined') return;

  // Observer for Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        console.log(`[LCP] ${lastEntry.startTime.toFixed(0)}ms`);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP measurement not supported');
    }

    // Observer for First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          console.log(`[FID] ${entry.processingStart - entry.startTime.toFixed(0)}ms`);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID measurement not supported');
    }

    // Observer for Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            console.log(`[CLS] ${clsValue.toFixed(4)}`);
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS measurement not supported');
    }
  }
}

/**
 * Debounces a function to improve performance
 * Useful for search inputs, resize handlers, etc.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttles a function to improve performance
 * Useful for scroll handlers, mouse events, etc.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Checks if the page load time is acceptable (< 3 seconds)
 */
export function isPageLoadAcceptable(): boolean {
  if (typeof window === 'undefined' || !performance.getEntriesByType) {
    return true; // Assume acceptable if we can't measure
  }

  const navigation = performance.getEntriesByType('navigation')[0] as any;
  if (!navigation) return true;

  const loadTime = navigation.loadEventEnd - navigation.fetchStart;
  return loadTime < 3000; // 3 seconds threshold
}

/**
 * Logs page load performance metrics
 */
export function logPageLoadMetrics() {
  if (typeof window === 'undefined' || !performance.getEntriesByType) {
    return;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as any;
  if (!navigation) return;

  console.group('📊 Page Load Metrics');
  console.log(`DNS Lookup: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(0)}ms`);
  console.log(`TCP Connection: ${(navigation.connectEnd - navigation.connectStart).toFixed(0)}ms`);
  console.log(`Request Time: ${(navigation.responseStart - navigation.requestStart).toFixed(0)}ms`);
  console.log(`Response Time: ${(navigation.responseEnd - navigation.responseStart).toFixed(0)}ms`);
  console.log(`DOM Processing: ${(navigation.domComplete - navigation.domInteractive).toFixed(0)}ms`);
  console.log(`Total Load Time: ${(navigation.loadEventEnd - navigation.fetchStart).toFixed(0)}ms`);
  console.groupEnd();

  return {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    request: navigation.responseStart - navigation.requestStart,
    response: navigation.responseEnd - navigation.responseStart,
    dom: navigation.domComplete - navigation.domInteractive,
    total: navigation.loadEventEnd - navigation.fetchStart,
  };
}
