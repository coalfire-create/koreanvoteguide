import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#0a0f1e" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          onAnimationComplete={(definition) => {
            if (definition === "exit") return;
          }}
        >
          <Particles />

          <div className="relative z-10 flex flex-col items-center">
            <motion.p
              className="text-white/90 text-2xl md:text-4xl font-bold tracking-wide"
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
            >
              나의 투표는
            </motion.p>

            <motion.p
              className="text-white text-3xl md:text-5xl font-bold tracking-wide mt-3 md:mt-4"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                textShadow: "0 0 40px rgba(100, 140, 255, 0.35), 0 0 80px rgba(100, 140, 255, 0.15)",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.5, ease: "easeOut" }}
            >
              이유가 있다.
            </motion.p>

            <motion.div
              className="h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent mt-8"
              initial={{ width: 0 }}
              animate={{ width: "280px" }}
              transition={{ duration: 0.6, delay: 2.8, ease: "easeInOut" }}
              onAnimationComplete={() => {
                setTimeout(() => setVisible(false), 600);
              }}
            />
          </div>

          <Ripples />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Particles() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 1.5,
    duration: Math.random() * 3 + 2,
  }));

  return (
    <div className="absolute inset-0 z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: `rgba(${120 + Math.random() * 60}, ${150 + Math.random() * 50}, 255, 0.4)`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.6, 0.3, 0.5, 0],
            scale: [0, 1, 1.5, 1, 0],
            y: [0, -20 - Math.random() * 30],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay + 0.3,
            ease: "easeInOut",
            repeat: 0,
          }}
        />
      ))}
    </div>
  );
}

function Ripples() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-white/[0.06]"
          initial={{ width: 0, height: 0, opacity: 0 }}
          animate={{
            width: [0, 600 + i * 200],
            height: [0, 600 + i * 200],
            opacity: [0, 0.15, 0],
          }}
          transition={{
            duration: 2.5,
            delay: 0.4 + i * 0.4,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
