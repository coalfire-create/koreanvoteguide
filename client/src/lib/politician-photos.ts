// 위키피디아에서 크롤링한 정치인 사진 URL (2026-05-06 기준)
// 사진이 없는 경우 → /api/politician-photo?name= 엔드포인트로 동적 조회

export const POLITICIAN_PHOTOS: Record<string, string> = {
  // 서울
  "오세훈": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/%EC%98%A4%EC%84%B8%ED%9B%88_%EC%84%9C%EC%9A%B8%EC%8B%9C%EC%9E%A5_%28cropped_3%29.jpg/330px-%EC%98%A4%EC%84%B8%ED%9B%88_%EC%84%9C%EC%9A%B8%EC%8B%9C%EC%9E%A5_%28cropped_3%29.jpg",
  "정원오": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/%EC%84%B1%EB%8F%99%EA%B5%AC%EC%B2%AD%EC%9E%A5_%EC%A0%95%EC%9B%90%EC%98%A4.jpg/330px-%EC%84%B1%EB%8F%99%EA%B5%AC%EC%B2%AD%EC%9E%A5_%EC%A0%95%EC%9B%90%EC%98%A4.jpg",
  "이재명": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/%EC%9D%B4%EC%9E%AC%EB%AA%85_%EC%9D%98%EC%9B%90_%28cropped%29.jpg/330px-%EC%9D%B4%EC%9E%AC%EB%AA%85_%EC%9D%98%EC%9B%90_%28cropped%29.jpg",
  "한동훈": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Han_Dong-hoon_20240102.jpg/330px-Han_Dong-hoon_20240102.jpg",
  "조국": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Cho_Kuk_20240327.jpg/330px-Cho_Kuk_20240327.jpg",
  "안철수": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Ahn_Cheol-soo_2022.jpg/330px-Ahn_Cheol-soo_2022.jpg",
  "나경원": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Na_Kyung-won_2024.jpg/330px-Na_Kyung-won_2024.jpg",
  "박지원": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Park_Jie-won_2024.jpg/330px-Park_Jie-won_2024.jpg",
  "이준석": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lee_Jun-seok_2024.jpg/330px-Lee_Jun-seok_2024.jpg",
  "추미애": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Choo_Mi-ae_2024.jpg/330px-Choo_Mi-ae_2024.jpg",
  "홍준표": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Hong_Joon-pyo_at_April_26_2025_Debate.png",
  "유정복": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Yoo_Jeong-bok.jpg/330px-Yoo_Jeong-bok.jpg",
  "강기정": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Kang_Gi-jung_20250117.jpg/330px-Kang_Gi-jung_20250117.jpg",
  "이정현": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/%EC%9D%B4%EC%A0%95%ED%98%84_%EC%9D%98%EC%9B%90.jpg/330px-%EC%9D%B4%EC%A0%95%ED%98%84_%EC%9D%98%EC%9B%90.jpg",
  "김동연": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Kim_Dong-yeon_20250324.jpg/330px-Kim_Dong-yeon_20250324.jpg",
  "김태흠": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Kim_Tae-heum_20230720.jpg/330px-Kim_Tae-heum_20230720.jpg",
  "양승조": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/%EC%96%91%EC%8A%B9%EC%A1%B0_%EC%B6%A9%EB%82%A8%EB%8F%84%EC%A7%80%EC%82%AC.jpg/330px-%EC%96%91%EC%8A%B9%EC%A1%B0_%EC%B6%A9%EB%82%A8%EB%8F%84%EC%A7%80%EC%82%AC.jpg",
  "김관영": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Kim_Kwan-young_%282024%29.jpg/330px-Kim_Kwan-young_%282024%29.jpg",
  "김영록": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Kim_Yung-rok_20250307.jpg/330px-Kim_Yung-rok_20250307.jpg",
  "박완수": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Park_Wan-su_20241008_%2805%29.jpg/330px-Park_Wan-su_20241008_%2805%29.jpg",
  "오영훈": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Oh_Young-hun_20240516.jpg/330px-Oh_Young-hun_20240516.jpg",
  // 지방선거 후보자 (Naver 인물 검색, 2026-05-08)
  "이상규": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Ft%2Fd5ac75e8-23e6-4786-864a-5dc795752dd6.png",
  "허경영": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2F164%2F202308091528525511.png",
  "박형준": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2Fportrait%2F202206%2F20220614124039717.jpg",
  "전재수": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2Fportrait%2F202211%2F20221122095241838.jpg",
  "박찬대": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Fcdee6480-f19b-4679-938b-e7d1de8b035b.jpg",
  "서거석": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2F74bfd628-5ab7-434d-a3d9-9819a2dd8986.jpg",
  "권영진": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Ft%2F7381c9cb-f586-4666-9622-ba1763563869.png",
  "양향자": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2Fportrait%2F202007%2F20200721125517249.jpg",
  "도성훈": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2Fportrait%2F201905%2F20190521110233864-4584238.jpg",
  "김철환": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Fa05ef477-3e1a-48ff-81d2-fe1193a8054b.jpg",
  "김은혜": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Fa23d2d1b-76c1-44a8-8a5c-8166128c3208.jpg",
  "원희룡": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2F191%2F202108311818471831.png",
  "부상일": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Fd8c03617-6157-4b9e-b7f6-526b56131d0e.jpg",
  "최동용": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2Fportrait%2F201410%2F20141022170731312.jpg",
  // 영천시장 후보
  "최기문": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2F10%2F201902151842384271.gif",
  "김병삼": "https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2F4%2F202308241801292351.jpg",
  "이정훈": "https://search.pstatic.net/common?type=n&size=240x300&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2Ft%2Fa599004e-eba6-4136-8c2d-62e8d692c45d.png",
  // ===== 동명이인 충돌 케이스 (검색 1순위가 다른 사람) =====
  // 황희: 조선시대 영의정 "황희정승"(1363-1452)이 검색 압도. 21·22대 더불어민주당 의원과 별개.
  "황희": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Korea_Colombia_Culture_Minister_Meeting_06.jpg/330px-Korea_Colombia_Culture_Minister_Meeting_06.jpg",
};

export function getPoliticianPhoto(name: string): string {
  // 1) 하드코딩된 URL 우선
  if (POLITICIAN_PHOTOS[name]) return POLITICIAN_PHOTOS[name];
  // 2) 서버 프록시 엔드포인트 (Wikipedia 동적 조회)
  return `/api/politician-photo?name=${encodeURIComponent(name)}`;
}
