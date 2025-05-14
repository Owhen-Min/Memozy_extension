import { useCallback } from "react";
import { CapturedItem, UrlGroup, Message, Response as ExtensionResponse } from "../../types";
import { useAuth } from "../useAuth";

export interface ProblemCreationData {
  quizCount: number;
  quizTypes: string[];
}

export function useProblemCreation(
  setCreatingProblemsUrls: React.Dispatch<React.SetStateAction<{ [url: string]: boolean }>>,
  loggedInUserEmail: string | null // 현재 로그인된 사용자 이메일
) {
  const { authToken } = useAuth(); // 백그라운드 메시지에 토큰 전달용

  const handleProblemModalSubmit = useCallback(
    async (
      data: ProblemCreationData,
      selectedItemForProblem: CapturedItem | null,
      selectedGroupInfo: {
        url: string;
        title: string;
        summaryId?: number;
        userEmail?: string;
      } | null
    ) => {
      // 부족한 정보 체크 및 상세 메시지 구성
      const missingInfo: string[] = [];

      if (!selectedItemForProblem) missingInfo.push("선택된 아이템");
      if (!authToken) missingInfo.push("인증 토큰");
      if (!selectedGroupInfo) missingInfo.push("그룹 정보");
      else {
        if (!selectedGroupInfo.summaryId) missingInfo.push("요약 ID");
        if (!selectedGroupInfo.userEmail) missingInfo.push("사용자 이메일");
      }
      if (!loggedInUserEmail) missingInfo.push("로그인 정보");

      if (missingInfo.length > 0) {
        const missingInfoText = missingInfo.join(", ");
        alert(`문제 생성에 필요한 정보가 부족합니다: ${missingInfoText}`);
        setCreatingProblemsUrls((prev) => ({ ...prev, [selectedGroupInfo?.url || ""]: false }));
        return;
      }

      // 여기서부터는 모든 필수 값이 있음이 보장됨
      // TypeScript가 이를 인식하지 못하므로 Type Assertion 사용

      // null이 아님을 단언(non-null assertion)
      const groupInfo = selectedGroupInfo!;
      const itemForProblem = selectedItemForProblem!;

      // 요청하는 그룹의 이메일과 현재 로그인한 사용자의 이메일이 일치하는지 확인
      if (groupInfo.userEmail !== loggedInUserEmail) {
        alert("현재 로그인된 사용자의 자료에 대해서만 문제를 생성할 수 있습니다.");
        setCreatingProblemsUrls((prev) => ({ ...prev, [groupInfo.url]: false }));
        return;
      }

      const pageUrl = groupInfo.url;
      setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: true }));

      try {
        // missingInfo에서 이미 모든 필수 값을 체크했으므로 loggedInUserEmail은 string임이 보장됨
        // 명시적으로 string으로 변환하여 타입 오류 해결
        const userEmailValue: string = loggedInUserEmail as string;

        const messagePayload: Message = {
          action: "createProblemRequest",
          summaryId: groupInfo.summaryId,
          quizCount: data.quizCount,
          quizTypes: data.quizTypes,
          userEmail: userEmailValue, // 명시적으로 string 타입의 변수 사용
          authToken: authToken || undefined, // 인증 토큰
          pageUrl: pageUrl, // 응답 매칭 또는 알림용
        };

        // 백그라운드로 메시지 전송
        chrome.runtime.sendMessage(messagePayload, (response: ExtensionResponse | undefined) => {
          if (chrome.runtime.lastError) {
            console.error("문제 생성 요청 오류:", chrome.runtime.lastError.message);
            alert(`문제 생성 요청 중 오류: ${chrome.runtime.lastError.message}`);
            setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: false }));
            return;
          }

          if (response && response.success && response.status === "problem_created") {
            console.log("문제 생성 성공 (백그라운드):");
            // 백그라운드가 스토리지를 업데이트하면 useUrlGroups가 자동으로 UI를 갱신할 것임
            // 필요시 여기서 setUrlGroups(response.updatedGroup) 등을 호출할 수 있으나, 중복 업데이트 가능성
            // alert("문제가 성공적으로 생성되었습니다."); // 백그라운드에서 알림을 주거나, 여기서 간단히 처리
          } else if (response && response.errorCode === "QUIZ400") {
            alert(
              `${itemForProblem.pageTitle} \n문제 생성 중 오류가 발생했습니다. \nMemozy는 현재 IT&개발자에 관련된 내용만 취급하고 있습니다.`
            );
          } else {
            console.error("문제 생성 실패 (백그라운드):", response?.error);
            alert(`문제 생성 실패: ${response?.error || "알 수 없는 오류"}`);
          }
          setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: false }));
        });
      } catch (error) {
        console.error("문제 생성 메시지 전송 중 예외:", error);
        alert("문제 생성 요청 중 예기치 않은 오류가 발생했습니다.");
        setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: false }));
      }
    },
    [authToken, loggedInUserEmail, setCreatingProblemsUrls /*, setUrlGroups */]
  );

  // handleCreateProblem 콜백은 Group 정보를 다루므로 selectedGroupInfo에 summaryId, userEmail이 있는지 확인 필요
  // History.tsx에서 openProblemModal 호출 시 selectedGroupInfo에 해당 정보가 포함되도록 해야 함.
  const handleCreateProblem = useCallback(
    (group: UrlGroup) => {
      if (loggedInUserEmail && group.userEmail !== loggedInUserEmail) {
        alert("다른 사용자의 그룹에 대한 문제를 생성할 수 없습니다.");
        return null;
      }
      if (group.problemId) {
        // navigate(`/problem/${group.problemId}`); // 직접적인 navigate 대신 다른 방식으로 처리 가능
        console.log(`이미 생성된 문제가 있습니다: ${group.problemId}`);
        // 이미 생성된 문제 페이지로 이동하는 로직은 History.tsx 등 호출부에서 처리하는 것이 나을 수 있음
        return null;
      }

      if (!group.summaryId) {
        alert("먼저 요약을 생성해주세요.");
        return null;
      }

      return {
        group, // group 객체 전체를 전달하여 selectedItemForProblem, selectedGroupInfo 대체 가능
        representativeItem: group.items.length > 0 ? group.items[0] : null,
      };
    },
    [loggedInUserEmail /*, navigate*/]
  );

  return {
    handleCreateProblem,
    handleProblemModalSubmit,
  };
}
