import { useNavigate, useParams } from "react-router-dom";
import "../../Global.css";
import { useEffect, useState } from "react";
import { useApiQuery } from "../../hooks/useApi";
import { CapturedItem } from "../../types";

// Quiz API 응답 타입 정의
interface QuizResponse {
  success: boolean;
  errorMsg?: string;
  errorCode?: string;
  data: Array<{
    quizId: number;
    type: string;
    content: string;
  }>;
}

export default function ProblemView() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [quizSource, setQuizSource] = useState<CapturedItem | null>(null);
  const numericProblemId = parseInt(problemId as string, 10);
  const [selectedQuizIds, setSelectedQuizIds] = useState<number[]>([]);

  // API로부터 퀴즈 데이터 가져오기
  const {
    data: quizData,
    isLoading,
    isError,
  } = useApiQuery<QuizResponse>(["quiz", problemId as string], `/quiz/${numericProblemId}`, {
    enabled: !!numericProblemId,
  });

  useEffect(() => {
    const loadProblem = async () => {
      try {
        const source = await chrome.storage.local.get(["savedItems"]);
        const items = source.savedItems || [];
        const foundProblem = items.find(
          (item: CapturedItem) => item.problemId === numericProblemId
        );
        if (foundProblem) {
          setQuizSource(foundProblem);
        } else {
          // 요약을 찾을 수 없는 경우
          alert("문제를 찾을 수 없습니다.");
          navigate("/");
        }
      } catch (error) {
        console.error("문제 로드 오류:", error);
        alert("문제를 불러오는 중 오류가 발생했습니다.");
        navigate("/");
      }
    };
    loadProblem();
  }, [problemId, navigate]);

  return (
    <div className="max-w-3xl mx-auto bg-level1 text-black p-5">
      <div className="flex items-center mt-2 mb-4">
        <img src="/icon48.png" alt="logo" className="w-10 h-10 mr-2" />
        <h1 className="text-3xl font-bold text-level6 m-0">문제 선정하기</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="w-full py-2 px-3 mb-4 border-b border-level5 flex items-center">
          {quizSource?.meta?.favicon && (
            <img src={quizSource?.meta?.favicon} alt="favicon" className="w-8 h-8 mr-3" />
          )}
          <span className="text-xl font-bold line-clamp-1">{quizSource?.pageTitle}</span>
          <button className="ml-auto text-sm border border-level3 bg-level2 text-level6 py-1 px-2 rounded-md cursor-pointer">
            문제 다시 만들기
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-4">데이터를 불러오는 중...</div>
        ) : isError ? (
          <div className="text-center py-4 text-red-500">데이터를 불러오는데 실패했습니다.</div>
        ) : quizData?.data && quizData.data.length > 0 ? (
          <>
            {quizData.data.map((quiz) => (
              <div
                key={quiz.quizId}
                className="w-full py-2 px-3 border border-light-gray rounded text-sm mb-4 min-h-[60px] bg-gray-50"
                onClick={() => {
                  if (selectedQuizIds.includes(quiz.quizId)) {
                    setSelectedQuizIds(selectedQuizIds.filter((id) => id !== quiz.quizId));
                  } else {
                    setSelectedQuizIds([...selectedQuizIds, quiz.quizId]);
                  }
                }}
              >
                <div className="font-medium mb-1">{quiz.type}</div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selectedQuizIds.includes(quiz.quizId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedQuizIds([...selectedQuizIds, quiz.quizId]);
                      } else {
                        setSelectedQuizIds(selectedQuizIds.filter((id) => id !== quiz.quizId));
                      }
                    }}
                  />
                  <div>{quiz.content}</div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="text-center py-4">퀴즈 데이터가 없습니다.</div>
        )}

        <div className="flex justify-end mt-4">
          <button
            className="bg-main text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            onClick={() => window.history.back()}
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
