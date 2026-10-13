import { chromium } from "playwright";

async function measurePage(url, viewport) {
  console.log(`Starting audit for ${url} at ${viewport.width}x${viewport.height}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  // Collect performance entries
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  // Web Vitals & Metrics via PerformanceObserver
  const metrics = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let cls = 0;
      let lcp = 0;
      let longTasks = [];
      let totalLongTaskDuration = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "layout-shift" && !entry.hadRecentInput) {
            cls += entry.value;
          }
          if (entry.entryType === "largest-contentful-paint") {
            lcp = entry.startTime;
          }
          if (entry.entryType === "longtask") {
            longTasks.push({ duration: entry.duration, startTime: entry.startTime });
            totalLongTaskDuration += Math.max(0, entry.duration - 50);
          }
        }
      });

      try {
        observer.observe({ type: "layout-shift", buffered: true });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
        observer.observe({ type: "longtask", buffered: true });
      } catch (e) {}

      setTimeout(() => {
        resolve({
          cls,
          lcp,
          longTasksCount: longTasks.length,
          tbt: totalLongTaskDuration,
        });
      }, 1000);
    });
  });

  // Measure Frame Times during scroll (30 seconds or 10-15s simulated steady scroll)
  const scrollResults = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const frameDeltas = [];
      let lastTime = performance.now();
      let animId;
      const startTime = performance.now();
      const targetDuration = 10000; // 10s steady scroll measurement

      function tick(now) {
        const delta = now - lastTime;
        lastTime = now;
        frameDeltas.push(delta);

        // Smooth scroll downwards then upwards
        const elapsed = now - startTime;
        const progress = (elapsed % 5000) / 5000;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const y = Math.sin(progress * Math.PI) * maxScroll;
        window.scrollTo(0, y);

        if (elapsed < targetDuration) {
          animId = requestAnimationFrame(tick);
        } else {
          // Compute percentiles
          frameDeltas.shift(); // remove initial spike
          frameDeltas.sort((a, b) => a - b);
          const p50 = frameDeltas[Math.floor(frameDeltas.length * 0.5)] || 16.6;
          const p95 = frameDeltas[Math.floor(frameDeltas.length * 0.95)] || 16.6;
          const dropped = frameDeltas.filter(d => d > 25).length;
          resolve({
            p50: Number(p50.toFixed(2)),
            p95: Number(p95.toFixed(2)),
            totalFrames: frameDeltas.length,
            droppedFrames: dropped,
            droppedPercent: Number(((dropped / frameDeltas.length) * 100).toFixed(2))
          });
        }
      }

      animId = requestAnimationFrame(tick);
    });
  });

  await browser.close();
  return { ...metrics, ...scrollResults };
}

async function run() {
  const desktop = { width: 1440, height: 900 };
  const mobile = { width: 390, height: 844 };

  const homeDesktop = await measurePage("http://localhost:3000", desktop);
  const homeMobile = await measurePage("http://localhost:3000", mobile);
  const pricingDesktop = await measurePage("http://localhost:3000/pricing", desktop);
  const loginDesktop = await measurePage("http://localhost:3000/login", desktop);

  console.log("=== PERFORMANCE MEASUREMENTS BASELINE ===");
  console.log("Home (1440x900):", homeDesktop);
  console.log("Home (390x844):", homeMobile);
  console.log("Pricing (1440x900):", pricingDesktop);
  console.log("Login (1440x900):", loginDesktop);
}

run().catch(console.error);
