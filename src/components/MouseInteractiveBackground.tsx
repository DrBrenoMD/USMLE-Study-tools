import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect } from "react";
import { cn } from "../lib/utils";

export function MouseInteractiveBackground({ className }: { className?: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth out the mouse movement for the background orb
  const smoothX = useSpring(mouseX, { damping: 50, stiffness: 300 });
  const smoothY = useSpring(mouseY, { damping: 50, stiffness: 300 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Center the orb on the mouse position
      mouseX.set(e.clientX - 250); 
      mouseY.set(e.clientY - 250);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY]);

  return (
    <div className={cn("pointer-events-none fixed inset-0 overflow-hidden bg-slate-50", className)}>
      <motion.div
        className="absolute h-[500px] w-[500px] rounded-full bg-slate-200/50 blur-[120px]"
        style={{
          x: smoothX,
          y: smoothY,
        }}
      />
    </div>
  );
}
