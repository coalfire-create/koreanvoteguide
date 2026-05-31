// 푸시 알림(APNs) 초기화 — 네이티브(iOS) 빌드에서만 동작. 웹에선 no-op.
// 권한 요청 → 등록 → 디바이스 토큰을 서버에 전송. 알림 탭 시 딥링크로 이동.
import { Capacitor } from "@capacitor/core";

let initialized = false;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function sendTokenToServer(token: string) {
  try {
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
    });
  } catch {
    // 네트워크 일시 오류는 무시 — 다음 앱 실행 시 재등록됨
  }
}

/**
 * @param onNavigate 알림 탭 시 SPA 라우팅에 사용할 콜백(예: wouter setLocation)
 */
export async function initPush(onNavigate?: (path: string) => void): Promise<void> {
  if (initialized || !isNative()) return;
  initialized = true;

  // 동적 import — 웹 번들에 네이티브 플러그인 코드가 섞이지 않도록
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const perm = await PushNotifications.checkPermissions();
  let receive = perm.receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") return; // 사용자가 거부하면 조용히 종료

  await PushNotifications.addListener("registration", (token) => {
    void sendTokenToServer(token.value);
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] registration error:", err?.error);
  });

  // 알림 탭 → payload.link 로 이동
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification?.data as Record<string, unknown> | undefined;
    const link = typeof data?.link === "string" ? data.link : undefined;
    if (link && onNavigate) onNavigate(link);
  });

  await PushNotifications.register();
}
