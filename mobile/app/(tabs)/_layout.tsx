import { Tabs, Redirect } from "expo-router";
import { Home, MessageSquare, Users, FileText, User } from "lucide-react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, Platform } from "react-native";

export default function TabsLayout() {
  const [hasRegion, setHasRegion] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("userRegions").then((val) => setHasRegion(!!val));
  }, []);

  if (hasRegion === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F2F7" }}>
        <ActivityIndicator size="large" color="#6D28D9" />
      </View>
    );
  }

  if (!hasRegion) return <Redirect href="/city-select" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6D28D9",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.94)",
          borderTopWidth: 0.5,
          borderTopColor: "rgba(0,0,0,0.15)",
          height: Platform.OS === "ios" ? 82 : 60,
          paddingBottom: Platform.OS === "ios" ? 26 : 8,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: -0.2,
        },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tabs.Screen name="community" options={{ title: "커뮤니티", tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} strokeWidth={2} /> }} />
      <Tabs.Screen name="members"   options={{ title: "의원",     tabBarIcon: ({ color, size }) => <Users       color={color} size={size} strokeWidth={2} /> }} />
      <Tabs.Screen name="index"     options={{ title: "홈",       tabBarIcon: ({ color, size }) => <Home        color={color} size={size} strokeWidth={2} /> }} />
      <Tabs.Screen name="bills"     options={{ title: "법안",     tabBarIcon: ({ color, size }) => <FileText    color={color} size={size} strokeWidth={2} /> }} />
      <Tabs.Screen name="more"      options={{ title: "마이",     tabBarIcon: ({ color, size }) => <User        color={color} size={size} strokeWidth={2} /> }} />
      <Tabs.Screen name="news"      options={{ href: null }} />
    </Tabs>
  );
}
