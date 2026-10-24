export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  year: number;
  state?: "done" | "error" | "stopped";
  error?: string;
}
export interface Conversation {
  summary: string;
  messages: ChatMessage[];
}
export const emptyConversation = (): Conversation => ({
  summary: "",
  messages: [],
});
export function trimConversation(c: Conversation): Conversation {
  const removed = c.messages.slice(0, -40),
    questions = removed
      .filter((m) => m.role === "user")
      .map((m) => m.year + "년 질문: " + m.content.slice(0, 160));
  return {
    summary: [c.summary, ...questions].filter(Boolean).join("\n").slice(-1600),
    messages: c.messages
      .slice(-40)
      .map((m) => ({ ...m, content: m.content.slice(0, 6000) })),
  };
}
export function historyForRequest(c: Conversation) {
  return c.messages
    .filter((m) => m.state !== "error" && m.state !== "stopped" && m.content)
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
}
export function loadConversation(worldId: string): Conversation {
  try {
    const c = JSON.parse(
      localStorage.getItem("epocharium-epi:" + worldId) || "null",
    );
    if (
      c &&
      typeof c.summary === "string" &&
      Array.isArray(c.messages) &&
      c.messages.length <= 80 &&
      c.messages.every(
        (m: ChatMessage) =>
          m &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string" &&
          m.content.length <= 6000 &&
          typeof m.year === "number" &&
          Number.isFinite(m.year),
      )
    )
      return trimConversation(c);
  } catch {}
  return emptyConversation();
}
export function saveConversation(worldId: string, c: Conversation) {
  try {
    localStorage.setItem(
      "epocharium-epi:" + worldId,
      JSON.stringify(trimConversation(c)),
    );
    return true;
  } catch {
    return false;
  }
}
export const errorMessages: Record<string, string> = {
  not_configured:
    "아직 세계의 먼 기록을 읽을 준비가 되지 않았어요. 서버에 DEEPSEEK_API_KEY를 등록해 주세요.",
  disabled:
    "에피의 대화 기능이 잠겨 있어요. 사건 보고와 게임 관찰은 계속할 수 있어요.",
  access_required: "초대 코드를 확인해 주세요.",
  origin: "허용되지 않은 접속 경로예요.",
  invalid_request:
    "질문이나 관측 자료가 허용 범위를 벗어났어요. 질문을 짧게 다시 적어 주세요.",
  request_too_large:
    "관측 자료가 너무 커요. 국가를 선택한 뒤 범위를 좁혀 주세요.",
  provider_request:
    "기록 서비스가 요청을 받지 못했어요. 서버 설정을 확인해 주세요.",
  provider_auth:
    "기록 서비스 인증을 확인해야 해요. 서버의 API 키를 확인해 주세요.",
  balance: "기록 서비스의 사용 잔액이 부족해요.",
  provider_limit:
    "기록 서비스가 잠시 붐비고 있어요. 잠시 뒤 다시 요청해 주세요.",
  local_limit:
    "오늘 또는 이번 시간의 대화 제한에 도달했어요. 잠시 쉬었다 이어가 주세요.",
  provider_unavailable:
    "기록 서비스가 잠시 쉬고 있어요. 잠시 뒤 다시 요청해 주세요.",
  timeout: "기록을 읽는 시간이 길어져 중단했어요.",
  stream_interrupted:
    "답변 연결이 중간에 끊겼어요. 아래 내용은 일부만 도착한 기록이에요.",
  connection_closed:
    "기록 서비스와 연결되지 않았어요. 개발 중이라면 npm run dev:epi 실행을 확인해 주세요.",
  provider_stream:'답변 도중 기록 서비스 오류가 발생했어요. 일부 내용만 남았을 수 있어요.',
  empty_response:'기록 서비스에서 빈 답변을 받았어요. 질문을 바꿔 다시 요청해 주세요.',
  parse: "기록을 읽는 중 형식 오류가 생겼어요.",
  response_limit: "답변 길이 한도에 도달했어요. 질문 범위를 좁혀 주세요.",
  duplicate_request: "이미 접수된 질문이에요. 중복 호출은 보내지 않았어요.",
  cancelled: "요청을 중단했어요.",
};
