import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import "../../styles/PageTransition.css";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState("page-enter");

  useEffect(() => {
    setTransitionStage("page-leave");
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage("page-enter");
    }, 150);
    return () => clearTimeout(timer);
  }, [location.pathname, children]);

  return <div className={`page-transition ${transitionStage}`}>{displayChildren}</div>;
}
