import React, { createContext, useState, useEffect } from 'react';

export const PerformanceContext = createContext({ fps: 0, memory: null });

export const PerformanceProvider = ({ children }) => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    let frames = 0;
    let lastTime = performance.now();
    const tick = () => {
      frames++;
      const now = performance.now();
      const delta = now - lastTime;
      if (delta >= 1000) {
        setFps(Math.round((frames * 1000) / delta));
        frames = 0;
        lastTime = now;
      }
      if (performance.memory) {
        setMemory({
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // cleanup not needed for requestAnimationFrame loop on unmount
    return () => {};
  }, []);

  return (
    <PerformanceContext.Provider value={{ fps, memory }}>
      {children}
    </PerformanceContext.Provider>
  );
};
