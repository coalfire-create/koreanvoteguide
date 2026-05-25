import { router } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 온보딩은 city-select로 리다이렉트
export default function OnboardingScreen() {
  useEffect(() => {
    AsyncStorage.getItem("userRegions").then((val) => {
      if (val) {
        router.replace("/(tabs)");
      } else {
        router.replace("/city-select");
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
