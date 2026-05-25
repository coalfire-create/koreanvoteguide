import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from "react-native";

interface ButtonProps extends TouchableOpacityProps {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  default: "bg-primary",
  outline: "bg-transparent border border-border",
  ghost: "bg-transparent",
  destructive: "bg-red-500",
};

const textStyles: Record<string, string> = {
  default: "text-white font-semibold",
  outline: "text-foreground font-semibold",
  ghost: "text-foreground font-semibold",
  destructive: "text-white font-semibold",
};

const sizeStyles: Record<string, string> = {
  default: "h-10 px-4",
  sm: "h-8 px-3",
  lg: "h-12 px-6",
};

const textSizeStyles: Record<string, string> = {
  default: "text-sm",
  sm: "text-xs",
  lg: "text-base",
};

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center rounded-lg ${variantStyles[variant]} ${sizeStyles[size]} ${disabled || loading ? "opacity-50" : ""} ${className ?? ""}`}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color={variant === "default" ? "#fff" : "#6366f1"} className="mr-2" />}
      {typeof children === "string" ? (
        <Text className={`${textStyles[variant]} ${textSizeStyles[size]}`}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
