import { useEffect, useRef } from "react";
import { Animated, View, type ViewProps } from "react-native";

export function Skeleton({ className, style, ...props }: ViewProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ opacity }, style]}
      className={`bg-slate-200 rounded-lg ${className ?? ""}`}
      {...props}
    />
  );
}
