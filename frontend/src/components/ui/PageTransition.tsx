import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import "../../styles/PageTransition.css";

// ============================================================
// PAGE TRANSITION
// Uses a ref to track pathname changes instead of calling
// setState synchronously inside an effect body
// ============================================================

export function PageTransition({ children }: { children: ReactNode }) {
  const location               = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState("page-enter");
  const prevPathname           = useRef(location.pathname);

  useEffect(() => {
    // Only trigger transition when pathname actually changes
    if (prevPathname.current === location.pathname) return;
    prevPathname.current = location.pathname;

    // Start leave phase
    setTransitionStage("page-leave");

    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage("page-enter");
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname, children]);

  return (
    <div className={`page-transition ${transitionStage}`}>
      {displayChildren}
    </div>
  );
}
