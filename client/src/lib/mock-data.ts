import type { AssemblyMember, Candidate, Bill } from "@shared/schema";

export const assemblyMembers: AssemblyMember[] = [
  {
    id: "m1",
    name: "김정호",
    party: "더불어민주당",
    district: "서울 강남구 갑",
    photo: "",
    electedYear: 2020,
    committee: "기획재정위원회",
    votingRecords: [
      { billId: "b1", billName: "국민건강보험법 일부개정법률안", vote: "찬성", date: "2025-03-15" },
      { billId: "b2", billName: "공직선거법 일부개정법률안", vote: "찬성", date: "2025-02-28" },
      { billId: "b3", billName: "소득세법 일부개정법률안", vote: "반대", date: "2025-02-10" },
      { billId: "b4", billName: "근로기준법 일부개정법률안", vote: "찬성", date: "2025-01-20" },
      { billId: "b5", billName: "교육기본법 일부개정법률안", vote: "찬성", date: "2024-12-15" },
      { billId: "b6", billName: "환경보전법 일부개정법률안", vote: "불출석", date: "2024-11-20" },
      { billId: "b7", billName: "정보통신망법 일부개정법률안", vote: "찬성", date: "2024-10-15" },
      { billId: "b8", billName: "부동산거래신고법 일부개정법률안", vote: "반대", date: "2024-09-10" },
      { billId: "b9", billName: "지방자치법 일부개정법률안", vote: "찬성", date: "2024-08-05" },
      { billId: "b10", billName: "국가재정법 일부개정법률안", vote: "찬성", date: "2024-07-15" },
      { billId: "b11", billName: "형사소송법 일부개정법률안", vote: "미참석", date: "2024-06-20" },
    ],
    activities: [
      { id: "a1", type: "speech", title: "본회의 대정부질문 발언", description: "경제 활성화를 위한 재정 정책 방향에 대해 질의", date: "2025-03-10" },
      { id: "a2", type: "event", title: "강남구 주민간담회 개최", description: "지역 현안 및 주거 안정 대책 논의", date: "2025-02-20" },
      { id: "a3", type: "press", title: "세금 감면 법안 발의 관련 기자회견", description: "중소기업 세금 감면 확대를 위한 법안 발의 배경 설명", date: "2025-01-15" },
    ],
    score: { attendanceRate: 91, billProposalCount: 15, votingParticipationRate: 88, totalScore: 85 },
  },
  {
    id: "m2",
    name: "박수연",
    party: "국민의힘",
    district: "부산 해운대구 을",
    photo: "",
    electedYear: 2020,
    committee: "국방위원회",
    votingRecords: [
      { billId: "b1", billName: "국민건강보험법 일부개정법률안", vote: "반대", date: "2025-03-15" },
      { billId: "b2", billName: "공직선거법 일부개정법률안", vote: "반대", date: "2025-02-28" },
      { billId: "b3", billName: "소득세법 일부개정법률안", vote: "찬성", date: "2025-02-10" },
      { billId: "b4", billName: "근로기준법 일부개정법률안", vote: "반대", date: "2025-01-20" },
      { billId: "b5", billName: "교육기본법 일부개정법률안", vote: "찬성", date: "2024-12-15" },
      { billId: "b6", billName: "환경보전법 일부개정법률안", vote: "찬성", date: "2024-11-20" },
      { billId: "b7", billName: "정보통신망법 일부개정법률안", vote: "반대", date: "2024-10-15" },
      { billId: "b8", billName: "부동산거래신고법 일부개정법률안", vote: "찬성", date: "2024-09-10" },
      { billId: "b9", billName: "지방자치법 일부개정법률안", vote: "불출석", date: "2024-08-05" },
      { billId: "b10", billName: "국가재정법 일부개정법률안", vote: "찬성", date: "2024-07-15" },
    ],
    activities: [
      { id: "a4", type: "speech", title: "국방위원회 법안심사 발언", description: "국방 예산 증액 필요성에 대한 발언", date: "2025-03-05" },
      { id: "a5", type: "event", title: "해운대구 안보 세미나 참석", description: "지역 안보 현안 및 국방력 강화 방안 논의", date: "2025-02-15" },
    ],
    score: { attendanceRate: 85, billProposalCount: 8, votingParticipationRate: 82, totalScore: 72 },
  },
  {
    id: "m3",
    name: "이민재",
    party: "더불어민주당",
    district: "경기 수원시 정",
    photo: "",
    electedYear: 2024,
    committee: "교육위원회",
    votingRecords: [
      { billId: "b1", billName: "국민건강보험법 일부개정법률안", vote: "찬성", date: "2025-03-15" },
      { billId: "b2", billName: "공직선거법 일부개정법률안", vote: "찬성", date: "2025-02-28" },
      { billId: "b3", billName: "소득세법 일부개정법률안", vote: "반대", date: "2025-02-10" },
      { billId: "b4", billName: "근로기준법 일부개정법률안", vote: "찬성", date: "2025-01-20" },
      { billId: "b5", billName: "교육기본법 일부개정법률안", vote: "찬성", date: "2024-12-15" },
      { billId: "b6", billName: "환경보전법 일부개정법률안", vote: "찬성", date: "2024-11-20" },
      { billId: "b7", billName: "정보통신망법 일부개정법률안", vote: "불출석", date: "2024-10-15" },
      { billId: "b8", billName: "부동산거래신고법 일부개정법률안", vote: "반대", date: "2024-09-10" },
      { billId: "b9", billName: "지방자치법 일부개정법률안", vote: "찬성", date: "2024-08-05" },
      { billId: "b10", billName: "국가재정법 일부개정법률안", vote: "찬성", date: "2024-07-15" },
      { billId: "b11", billName: "형사소송법 일부개정법률안", vote: "찬성", date: "2024-06-20" },
      { billId: "b12", billName: "청소년보호법 일부개정법률안", vote: "찬성", date: "2024-05-10" },
    ],
    activities: [
      { id: "a6", type: "speech", title: "교육위원회 교육 정책 토론 발언", description: "공교육 강화를 위한 교사 처우 개선 방안 발언", date: "2025-03-01" },
      { id: "a7", type: "press", title: "교육 예산 확대 촉구 기자회견", description: "2026년도 교육 예산 확대의 필요성을 역설", date: "2025-02-05" },
      { id: "a8", type: "event", title: "수원시 학부모 간담회", description: "학교 폭력 예방 및 방과후 프로그램 확대 논의", date: "2025-01-10" },
    ],
    score: { attendanceRate: 96, billProposalCount: 22, votingParticipationRate: 95, totalScore: 93 },
  },
  {
    id: "m4",
    name: "최은비",
    party: "국민의힘",
    district: "대구 달서구 갑",
    photo: "",
    electedYear: 2020,
    committee: "보건복지위원회",
    votingRecords: [
      { billId: "b1", billName: "국민건강보험법 일부개정법률안", vote: "반대", date: "2025-03-15" },
      { billId: "b2", billName: "공직선거법 일부개정법률안", vote: "불출석", date: "2025-02-28" },
      { billId: "b3", billName: "소득세법 일부개정법률안", vote: "찬성", date: "2025-02-10" },
      { billId: "b4", billName: "근로기준법 일부개정법률안", vote: "미참석", date: "2025-01-20" },
      { billId: "b5", billName: "교육기본법 일부개정법률안", vote: "찬성", date: "2024-12-15" },
      { billId: "b6", billName: "환경보전법 일부개정법률안", vote: "반대", date: "2024-11-20" },
      { billId: "b7", billName: "정보통신망법 일부개정법률안", vote: "미참석", date: "2024-10-15" },
      { billId: "b8", billName: "부동산거래신고법 일부개정법률안", vote: "찬성", date: "2024-09-10" },
      { billId: "b9", billName: "지방자치법 일부개정법률안", vote: "찬성", date: "2024-08-05" },
      { billId: "b10", billName: "국가재정법 일부개정법률안", vote: "불출석", date: "2024-07-15" },
    ],
    activities: [
      { id: "a9", type: "speech", title: "보건복지위원회 발언", description: "저출산 대책 및 육아 지원 확대 방안 발언", date: "2025-02-25" },
      { id: "a10", type: "event", title: "달서구 복지시설 방문", description: "노인복지시설 현장 점검 및 개선 요구사항 청취", date: "2025-01-30" },
    ],
    score: { attendanceRate: 72, billProposalCount: 5, votingParticipationRate: 68, totalScore: 58 },
  },
  {
    id: "m5",
    name: "한도영",
    party: "조국혁신당",
    district: "인천 남동구 을",
    photo: "",
    electedYear: 2024,
    committee: "법제사법위원회",
    votingRecords: [
      { billId: "b1", billName: "국민건강보험법 일부개정법률안", vote: "찬성", date: "2025-03-15" },
      { billId: "b2", billName: "공직선거법 일부개정법률안", vote: "찬성", date: "2025-02-28" },
      { billId: "b3", billName: "소득세법 일부개정법률안", vote: "찬성", date: "2025-02-10" },
      { billId: "b4", billName: "근로기준법 일부개정법률안", vote: "찬성", date: "2025-01-20" },
      { billId: "b5", billName: "교육기본법 일부개정법률안", vote: "찬성", date: "2024-12-15" },
      { billId: "b6", billName: "환경보전법 일부개정법률안", vote: "찬성", date: "2024-11-20" },
      { billId: "b7", billName: "정보통신망법 일부개정법률안", vote: "찬성", date: "2024-10-15" },
      { billId: "b8", billName: "부동산거래신고법 일부개정법률안", vote: "반대", date: "2024-09-10" },
      { billId: "b9", billName: "지방자치법 일부개정법률안", vote: "찬성", date: "2024-08-05" },
      { billId: "b10", billName: "국가재정법 일부개정법률안", vote: "찬성", date: "2024-07-15" },
      { billId: "b11", billName: "형사소송법 일부개정법률안", vote: "찬성", date: "2024-06-20" },
    ],
    activities: [
      { id: "a11", type: "speech", title: "법제사법위원회 법안심사 발언", description: "검찰 개혁 관련 법안 심사에서의 찬성 발언", date: "2025-03-08" },
      { id: "a12", type: "press", title: "사법 개혁 촉구 기자회견", description: "공수처 기능 강화를 위한 법안 발의 관련 기자회견", date: "2025-02-12" },
      { id: "a13", type: "event", title: "인천 시민 토론회 참석", description: "지역 사법 접근성 향상을 위한 시민 토론회 참석", date: "2025-01-25" },
    ],
    score: { attendanceRate: 98, billProposalCount: 18, votingParticipationRate: 96, totalScore: 91 },
  },
  {
    id: "m6",
    name: "정서윤",
    party: "더불어민주당",
    district: "광주 북구 갑",
    photo: "",
    electedYear: 2020,
    committee: "환경노동위원회",
    votingRecords: [
      { billId: "b1", billName: "국민건강보험법 일부개정법률안", vote: "찬성", date: "2025-03-15" },
      { billId: "b2", billName: "공직선거법 일부개정법률안", vote: "찬성", date: "2025-02-28" },
      { billId: "b3", billName: "소득세법 일부개정법률안", vote: "반대", date: "2025-02-10" },
      { billId: "b4", billName: "근로기준법 일부개정법률안", vote: "찬성", date: "2025-01-20" },
      { billId: "b5", billName: "교육기본법 일부개정법률안", vote: "불출석", date: "2024-12-15" },
      { billId: "b6", billName: "환경보전법 일부개정법률안", vote: "찬성", date: "2024-11-20" },
      { billId: "b7", billName: "정보통신망법 일부개정법률안", vote: "찬성", date: "2024-10-15" },
      { billId: "b8", billName: "부동산거래신고법 일부개정법률안", vote: "반대", date: "2024-09-10" },
      { billId: "b9", billName: "지방자치법 일부개정법률안", vote: "찬성", date: "2024-08-05" },
      { billId: "b10", billName: "국가재정법 일부개정법률안", vote: "찬성", date: "2024-07-15" },
      { billId: "b11", billName: "형사소송법 일부개정법률안", vote: "찬성", date: "2024-06-20" },
    ],
    activities: [
      { id: "a14", type: "speech", title: "환경노동위원회 발언", description: "탄소중립 2050 이행 점검에 대한 발언", date: "2025-03-03" },
      { id: "a15", type: "event", title: "광주 환경 포럼 참석", description: "신재생에너지 전환 관련 지역 포럼 참석", date: "2025-01-18" },
    ],
    score: { attendanceRate: 88, billProposalCount: 12, votingParticipationRate: 85, totalScore: 79 },
  },
];

export const candidates: Candidate[] = [
  {
    id: "c1",
    name: "이재명",
    party: "더불어민주당",
    photo: "",
    electionType: "presidential",
    background: "前 경기도지사, 제20대 대통령선거 후보. 성남시장 재직 시 청년배당, 무상교복 등 보편적 복지 정책을 추진하며 전국적 주목을 받음. 경기도지사로서 기본소득 정책의 전국 확대를 주도.",
    promises: [
      { id: "p1", title: "기본소득 도입", description: "전 국민 대상 기본소득 단계적 도입으로 소득 양극화 해소" },
      { id: "p2", title: "부동산 가격 안정화", description: "공공주택 100만호 공급 및 토지공개념 강화로 부동산 가격 안정" },
      { id: "p3", title: "디지털 전환 가속화", description: "AI·빅데이터 기반 정부 혁신 및 디지털 뉴딜 확대" },
    ],
    pastActivities: [
      "성남시장 재직 (2010-2018)",
      "경기도지사 재직 (2018-2022)",
      "청년배당 전국 최초 시행",
      "경기도 재난기본소득 시행",
    ],
    timeline: [
      { id: "t1", date: "2025-01-15", title: "대선 출마 선언", description: "제21대 대통령선거 출마 공식 선언" },
      { id: "t2", date: "2025-02-01", title: "경제 공약 발표", description: "기본소득 및 경제민주화 관련 핵심 공약 발표" },
      { id: "t3", date: "2025-02-20", title: "전국 순회 시작", description: "전국 17개 광역시도 순회 유세 시작" },
    ],
    ratings: [4, 5, 3, 4, 5, 4, 3, 5, 4, 4],
  },
  {
    id: "c2",
    name: "김문수",
    party: "국민의힘",
    photo: "",
    electionType: "presidential",
    background: "前 경기도지사, 노동운동가 출신 정치인. 노동계에서 정치로 전환한 독특한 경력의 소유자. 경기도지사 재직 시 기업 유치 및 경제 활성화에 주력.",
    promises: [
      { id: "p4", title: "규제 혁파", description: "기업 활동 규제 대폭 완화로 경제 성장 동력 확보" },
      { id: "p5", title: "안보 강화", description: "한미동맹 강화 및 국방력 현대화 추진" },
      { id: "p6", title: "교육 개혁", description: "대학 자율성 확대 및 직업교육 강화" },
    ],
    pastActivities: [
      "경기도지사 재직 (2006-2014)",
      "국회의원 3선",
      "노동운동 경력 15년",
      "한국경영자총협회 자문위원",
    ],
    timeline: [
      { id: "t4", date: "2025-01-20", title: "대선 출마 선언", description: "국민의힘 대선 후보 출마 공식 선언" },
      { id: "t5", date: "2025-02-10", title: "경제 비전 발표", description: "자유시장경제 기반 경제 성장 비전 발표" },
    ],
    ratings: [3, 4, 3, 2, 4, 3, 3, 4, 3, 2],
  },
  {
    id: "c3",
    name: "오세훈",
    party: "국민의힘",
    photo: "",
    electionType: "local",
    background: "現 서울특별시장. 변호사 출신으로 서울시장 재직 시 도시 재생 및 교통 인프라 개선에 주력. 한강 르네상스 프로젝트로 주목받음.",
    promises: [
      { id: "p7", title: "서울 그린시티 조성", description: "2030년까지 서울시 탄소배출 40% 감축 및 도시숲 확대" },
      { id: "p8", title: "청년 주거 안정", description: "역세권 청년주택 5만호 추가 공급" },
      { id: "p9", title: "대중교통 혁신", description: "GTX 조기 완공 및 자율주행 버스 시범 운행" },
    ],
    pastActivities: [
      "서울특별시장 재직 (2006-2011, 2021-현재)",
      "변호사 경력 10년",
      "한강 르네상스 프로젝트 추진",
    ],
    timeline: [
      { id: "t6", date: "2025-01-10", title: "지방선거 재출마 선언", description: "서울시장 재선 도전 공식 선언" },
      { id: "t7", date: "2025-02-15", title: "도시재생 성과 발표", description: "임기 중 도시재생 사업 성과 발표회" },
    ],
    ratings: [4, 3, 4, 5, 3, 4, 4, 3, 4, 5],
  },
];

export const bills: Bill[] = [
  {
    id: "b1",
    name: "국민건강보험법 일부개정법률안",
    summary: "건강보험 보장성을 강화하여 국민의 의료비 부담을 줄이고, 비급여 항목의 급여 전환을 촉진하는 법안입니다. 특히 중증질환자의 본인부담금을 현행 대비 50% 감소시키는 것을 목표로 합니다.",
    proposedDate: "2025-02-20",
    proposer: "김정호",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "반대" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "반대" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b2",
    name: "공직선거법 일부개정법률안",
    summary: "선거운동 기간 중 온라인 선거운동의 범위를 확대하고, 소셜미디어를 통한 정책 홍보 활동을 합법화하는 법안입니다. 유권자의 정보 접근성을 높이는 것이 핵심 목표입니다.",
    proposedDate: "2025-02-10",
    proposer: "이민재",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "반대" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "불출석" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b3",
    name: "소득세법 일부개정법률안",
    summary: "고소득자에 대한 소득세율을 인상하고, 근로소득세 공제 한도를 확대하여 저·중소득 근로자의 세금 부담을 경감하는 법안입니다.",
    proposedDate: "2025-01-25",
    proposer: "박수연",
    status: "계류",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "반대" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "찬성" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "반대" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "찬성" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "반대" },
    ],
  },
  {
    id: "b4",
    name: "근로기준법 일부개정법률안",
    summary: "주 52시간 근무제의 예외 업종을 축소하고, 야간·휴일 근무에 대한 할증 수당 비율을 현행 50%에서 75%로 상향하는 법안입니다.",
    proposedDate: "2025-01-10",
    proposer: "정서윤",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "반대" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "미참석" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b5",
    name: "교육기본법 일부개정법률안",
    summary: "교원의 교육활동 보호를 강화하고, 학교폭력 예방을 위한 전문상담교사 배치를 의무화하는 법안입니다.",
    proposedDate: "2024-12-01",
    proposer: "이민재",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "찬성" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "찬성" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "불출석" },
    ],
  },
  {
    id: "b6",
    name: "환경보전법 일부개정법률안",
    summary: "대기오염물질 배출 기준을 강화하고, 환경영향평가 대상 사업의 범위를 확대하여 국민의 환경권을 보장하는 법안입니다.",
    proposedDate: "2024-11-05",
    proposer: "정서윤",
    status: "계류",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "불출석" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "찬성" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "반대" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b7",
    name: "정보통신망법 일부개정법률안",
    summary: "개인정보 보호를 강화하고, 온라인 플랫폼 사업자의 이용자 보호 의무를 확대하는 법안입니다. AI 기반 서비스의 개인정보 처리 기준도 신설합니다.",
    proposedDate: "2024-10-01",
    proposer: "한도영",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "반대" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "불출석" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "미참석" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b8",
    name: "부동산거래신고법 일부개정법률안",
    summary: "부동산 허위매물 신고를 강화하고, 실거래가 공개 범위를 확대하여 부동산 시장의 투명성을 높이는 법안입니다.",
    proposedDate: "2024-09-01",
    proposer: "김정호",
    status: "폐기",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "반대" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "찬성" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "반대" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "찬성" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "반대" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "반대" },
    ],
  },
  {
    id: "b9",
    name: "지방자치법 일부개정법률안",
    summary: "지방자치단체의 자치입법권을 확대하고, 주민참여예산제의 참여 범위를 넓혀 풀뿌리 민주주의를 강화하는 법안입니다.",
    proposedDate: "2024-07-20",
    proposer: "이민재",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "불출석" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "찬성" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b10",
    name: "국가재정법 일부개정법률안",
    summary: "국가 재정 운용의 투명성을 강화하고, 예산 낭비를 방지하기 위한 재정 감시 기구의 권한을 확대하는 법안입니다.",
    proposedDate: "2024-07-01",
    proposer: "박수연",
    status: "계류",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "찬성" },
      { memberId: "m2", memberName: "박수연", party: "국민의힘", vote: "찬성" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m4", memberName: "최은비", party: "국민의힘", vote: "불출석" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b11",
    name: "형사소송법 일부개정법률안",
    summary: "피의자 및 피고인의 인권 보호를 강화하고, 수사 과정에서의 변호인 접견권을 확대하는 법안입니다.",
    proposedDate: "2024-06-05",
    proposer: "한도영",
    status: "통과",
    votes: [
      { memberId: "m1", memberName: "김정호", party: "더불어민주당", vote: "미참석" },
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
      { memberId: "m5", memberName: "한도영", party: "조국혁신당", vote: "찬성" },
      { memberId: "m6", memberName: "정서윤", party: "더불어민주당", vote: "찬성" },
    ],
  },
  {
    id: "b12",
    name: "청소년보호법 일부개정법률안",
    summary: "온라인 환경에서의 청소년 보호를 강화하고, 유해 콘텐츠 차단 기술 개발을 지원하는 법안입니다.",
    proposedDate: "2024-05-01",
    proposer: "이민재",
    status: "통과",
    votes: [
      { memberId: "m3", memberName: "이민재", party: "더불어민주당", vote: "찬성" },
    ],
  },
];

export function getPartyColor(party: string): string {
  switch (party) {
    case "더불어민주당": return "bg-blue-500 dark:bg-blue-600";
    case "국민의힘": return "bg-red-500 dark:bg-red-600";
    case "조국혁신당": return "bg-indigo-500 dark:bg-indigo-600";
    default: return "bg-gray-500 dark:bg-gray-600";
  }
}

export function getPartyTextColor(party: string): string {
  switch (party) {
    case "더불어민주당": return "text-blue-600 dark:text-blue-400";
    case "국민의힘": return "text-red-600 dark:text-red-400";
    case "조국혁신당": return "text-indigo-600 dark:text-indigo-400";
    default: return "text-gray-600 dark:text-gray-400";
  }
}

export function getVoteColor(vote: string): string {
  switch (vote) {
    case "찬성": return "text-emerald-600 dark:text-emerald-400";
    case "반대": return "text-red-600 dark:text-red-400";
    case "불출석": return "text-gray-400 dark:text-gray-500";
    case "미참석": return "text-gray-800 dark:text-gray-300";
    default: return "";
  }
}

export function getVoteBgColor(vote: string): string {
  switch (vote) {
    case "찬성": return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "반대": return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "불출석": return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
    case "미참석": return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    default: return "";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-blue-600 dark:text-blue-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function getScoreGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "C+";
  if (score >= 65) return "C";
  if (score >= 55) return "D";
  return "F";
}
