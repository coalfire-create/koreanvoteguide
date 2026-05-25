import { View, Text } from "react-native";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary";
  className?: string;
}

const variantStyles = {
  default: "bg-primary",
  outline: "border border-border bg-transparent",
  secondary: "bg-secondary",
};

const textStyles = {
  default: "text-white",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <View className={`px-2 py-0.5 rounded-full self-start ${variantStyles[variant]} ${className ?? ""}`}>
      <Text className={`text-xs font-medium ${textStyles[variant]}`}>
        {typeof children === "string" ? children : null}
      </Text>
    </View>
  );
}
