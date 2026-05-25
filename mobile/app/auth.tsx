import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, User, Lock, Eye, EyeOff } from "lucide-react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { user, login, mutate } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  if (user) {
    router.replace("/(tabs)");
    return null;
  }

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("입력 오류", "아이디와 비밀번호를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("로그인 실패", err.message ?? "아이디 또는 비밀번호를 확인해주세요");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      await apiRequest("POST", "/api/auth/apple/native", {
        identityToken: credential.identityToken,
        fullName: credential.fullName,
      });
      await mutate();
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("로그인 실패", err.message ?? "Apple 로그인 중 오류가 발생했습니다");
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#4c1d95" }}
    >
      {/* Header gradient */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 40 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 32 }}
        >
          <ArrowLeft color="white" size={20} strokeWidth={2} />
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 22 }}>이유</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "900", color: "white", marginBottom: 6 }}>이유있는 투표</Text>
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>로그인하고 모든 기능을 사용하세요</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "white", borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
        contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 24 }}>로그인</Text>

        {/* Apple Sign In — iOS only */}
        {Platform.OS === "ios" && (
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={{ width: "100%", height: 54, marginBottom: 16 }}
              onPress={handleAppleLogin}
            />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginHorizontal: 12 }}>또는 아이디로</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
            </View>
          </>
        )}

        {/* ID Field */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>아이디</Text>
          <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, height: 50 }}>
            <User color="#9CA3AF" size={16} strokeWidth={2} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="아이디를 입력하세요"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" }}
            />
          </View>
        </View>

        {/* Password Field */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>비밀번호</Text>
          <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, height: 50 }}>
            <Lock color="#9CA3AF" size={16} strokeWidth={2} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPass}
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" }}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPass((s) => !s)} activeOpacity={0.7}>
              {showPass
                ? <EyeOff color="#9CA3AF" size={18} strokeWidth={2} />
                : <Eye color="#9CA3AF" size={18} strokeWidth={2} />
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
          style={{ height: 54, backgroundColor: loading ? "#a5b4fc" : "#6366f1", borderRadius: 16, alignItems: "center", justifyContent: "center" }}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>로그인</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
