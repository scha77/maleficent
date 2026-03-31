import { useState, useEffect, useRef } from "react";

export default function LazyEmbed({ children, style, className }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={style} className={className}>
      {visible ? (
        children
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            minHeight: "120px",
            color: "rgba(255,255,255,0.15)",
            fontSize: "13px",
          }}
        >
          Loading&hellip;
        </div>
      )}
    </div>
  );
}
