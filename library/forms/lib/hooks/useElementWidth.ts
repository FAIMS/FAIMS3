import {useState, useEffect} from 'react';

// Simple hook to get element width
export const useElementWidth = (ref: React.RefObject<HTMLElement>) => {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return width;
};
