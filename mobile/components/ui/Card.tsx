import { View, type ViewProps } from "react-native";

export function Card({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={`bg-card rounded-2xl border border-border/30 shadow-sm ${className ?? ""}`}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardContent({ className, children, ...props }: ViewProps) {
  return (
    <View className={`p-4 ${className ?? ""}`} {...props}>
      {children}
    </View>
  );
}
