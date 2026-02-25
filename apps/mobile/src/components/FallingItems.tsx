import { useEffect, useRef } from "react";
import { uiImages } from "../assets/images";
import styles from "./FallingItems.module.css";

export function FallingItems() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    for (const item of container.querySelectorAll<HTMLElement>(`.${styles.fallingItem}`)) {
      const size = Math.random() * 140 + 25;
      item.style.width = `${size}px`;
      item.style.height = `${size}px`;
      item.style.left = `${Math.random() * 90 + 5}%`;
      item.style.animationDuration = `${Math.random() * 6 + 14}s`;
    }
  }, []);

  return (
    <div ref={containerRef}>
      {[0, 2, 4].map((delay) => (
        <div
          key={`heart-${delay}`}
          className={styles.fallingItem}
          style={{ backgroundImage: `url(${uiImages.heart})`, animationDelay: `${delay}s` }}
        />
      ))}
      {[1, 3, 5].map((delay) => (
        <div
          key={`star-${delay}`}
          className={styles.fallingItem}
          style={{ backgroundImage: `url(${uiImages.star})`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
