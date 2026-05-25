import { TextInput, View, Text, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="w-full">
      {label && <Text className="text-sm font-medium text-foreground mb-1">{label}</Text>}
      <TextInput
        className={`h-10 px-3 border rounded-lg bg-background text-foreground text-sm ${error ? "border-red-500" : "border-border"} ${className ?? ""}`}
        placeholderTextColor="#94a3b8"
        {...props}
      />
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
    </View>
  );
}
