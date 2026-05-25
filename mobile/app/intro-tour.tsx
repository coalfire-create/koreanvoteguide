import { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, Dimensions,
  FlatList, NativeScrollEvent, NativeSyntheticEvent, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronRight, Map, BarChart2, Newspaper, MessageCircle } from "lucide-react-native";
import { getDaysUntilElection } from "@/lib/election-config";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const SLIDES = [
  {
    Icon: Map,
    accentColor: "#a78bfa",
    bgTop: "#4c1d95",
    bgBottom: "#6D28D9",
    title: "이유있게\n투표하세요",
    desc: "2026 지방선거를 앞두고\n후보자 정보부터 의원 활동까지\n한 곳에서 확인하세요.",
    isFirst: true,
  },
  {
    Icon: Map,
    accentColor: "#93c5fd",
    bgTop: "#1e3a8a",
    bgBottom: "#2563EB",
    title: "지역 후보자 비교",
    desc: "내 지역 후보들의 공약·이력·뉴스를\n한 눈에 비교하세요.",
    isFirst: false,
  },
  {
    Icon: BarChart2,
    accentColor: "#6ee7b7",
    bgTop: "#064e3b",
    bgBottom: "#0F766E",
    title: "국회의원 표결 추적",
    desc: "내가 지지하는 의원이\n어떤 법안에 어떻게 투표했는지\n확인할 수 있어요.",
    isFirst: false,
  },
  {
    Icon: Newspaper,
    accentColor: "#fcd34d",
    bgTop: "#78350f",
    bgBottom: "#B45309",
    title: "AI 정치 뉴스 분석",
    desc: "12개 언론사 뉴스를\nAI가 핵심만 추려서\n편향 없이 전달합니다.",
    isFirst: false,
  },
  {
    Icon: MessageCircle,
    accentColor: "#f9a8d4",
    bgTop: "#831843",
    bgBottom: "#BE185D",
    title: "유권자 커뮤니티",
    desc: "이웃들과 지역 현안과 정치를\n자유롭게 이야기하세요.",
    isFirst: false,
  },
];

export default function IntroTourScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const daysLeft = getDaysUntilElection();

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setCurrentIndex(idx);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("hasSeenTour", "true");
    router.replace("/(tabs)");
  };

  const slide = SLIDES[currentIndex];

  return (
    <View style={{ flex: 1, backgroundColor: slide.bgTop }}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          const Icon = item.Icon;
          return (
            <View style={{ width: SCREEN_W, height: SCREEN_H, backgroundColor: item.bgTop }}>
              {/* Top visual area */}
              <View style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: insets.top + 20,
              }}>
                {/* App logo row */}
                <View style={{
                  position: "absolute",
                  top: insets.top + 20,
                  left: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <Image
                    source={require("../assets/icon.png")}
                    style={{ width: 32, height: 32, borderRadius: 9 }}
                  />
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 15 }}>이유</Text>
                </View>

                {/* Decorative circles */}
                <View style={{
                  position: "absolute",
                  width: SCREEN_W * 1.2,
                  height: SCREEN_W * 1.2,
                  borderRadius: SCREEN_W * 0.6,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  top: -SCREEN_W * 0.3,
                  alignSelf: "center",
                }} />
                <View style={{
                  position: "absolute",
                  width: SCREEN_W * 0.7,
                  height: SCREEN_W * 0.7,
                  borderRadius: SCREEN_W * 0.35,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  bottom: 40,
                  right: -SCREEN_W * 0.15,
                }} />

                {/* Main icon */}
                <View style={{
                  width: 140,
                  height: 140,
                  borderRadius: 40,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 28,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}>
                  <View style={{
                    width: 100,
                    height: 100,
                    borderRadius: 28,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Icon color={item.accentColor} size={48} strokeWidth={1.5} />
                  </View>
                </View>

                {/* D-day badge (first slide only) */}
                {item.isFirst && (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 100,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                  }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fde047" }} />
                    <Text style={{ color: "white", fontSize: 13, fontWeight: "800" }}>2026 지방선거 D-{daysLeft}</Text>
                  </View>
                )}

                {/* Title + desc in visual area */}
                <Text style={{
                  fontSize: 30,
                  fontWeight: "900",
                  color: "white",
                  textAlign: "center",
                  lineHeight: 38,
                  paddingHorizontal: 32,
                  marginBottom: 14,
                }}>
                  {item.title}
                </Text>
                <Text style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  lineHeight: 24,
                  paddingHorizontal: 40,
                }}>
                  {item.desc}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Bottom Controls - fixed overlay */}
      <View style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 28,
        paddingTop: 20,
      }}>
        {/* Dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: currentIndex === i ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: currentIndex === i ? "white" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {currentIndex > 0 && (
            <TouchableOpacity
              onPress={handleFinish}
              style={{
                flex: 1,
                height: 54,
                borderRadius: 17,
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.3)",
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.75}
            >
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: "700" }}>건너뛰기</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={{
              flex: currentIndex === 0 ? undefined : 2,
              width: currentIndex === 0 ? "100%" : undefined,
              height: 54,
              borderRadius: 17,
              backgroundColor: "white",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: SLIDES[currentIndex].bgBottom }}>
              {currentIndex === SLIDES.length - 1 ? "시작하기" : "다음"}
            </Text>
            <ChevronRight color={SLIDES[currentIndex].bgBottom} size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
