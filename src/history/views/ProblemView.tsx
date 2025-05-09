import { useNavigate, useParams } from "react-router";
import "../../Global.css";
import { useEffect, useState } from "react";
import { useApiQuery, useApiMutation } from "../../hooks/useApi";
import { UrlGroup } from "../../types";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import NewProblemModal from "../features/problemView/NewProblemModal";

export interface Quiz {
  quizId: number;
  type: string;
  content: string;
}

// Quiz API 응답 타입 정의
interface QuizResponse {
  success: boolean;
  errorMsg?: string;
  errorCode?: string;
  data: Array<Quiz>;
}

interface SaveQuizResponse {
  success: boolean;
  errorMsg?: string;
  errorCode?: string;
}

interface Collection {
  id: number;
  name: string;
  quizCount: number;
  memozyCount: number;
}

interface CollectionResponse {
  success: boolean;
  errorMsg?: string;
  errorCode?: string;
  data: Array<Collection>;
}

export default function ProblemView() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [quizSource, setQuizSource] = useState<UrlGroup | null>(null);
  const numericProblemId = parseInt(problemId as string, 10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [newCollectionName, setNewCollectionName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isNewProblemModalOpen, setIsNewProblemModalOpen] = useState<boolean>(false);
  // API로부터 퀴즈 데이터 가져오기
  const {
    data: quizData,
    isLoading: quizLoading,
    isError: quizError,
  } = useApiQuery<QuizResponse>(["quiz", problemId as string], `/quiz/${numericProblemId}`, {
    enabled: !!numericProblemId,
  });

  const { data: collectionData, refetch: refetchCollection } = useApiQuery<CollectionResponse>(
    ["collection"],
    `/collection`
  );

  const { mutate: saveQuiz, isPending: isSavingQuiz } = useApiMutation<SaveQuizResponse>(
    `/collection/${selectedCollectionId}/quiz`,
    {
      onSuccess: (data) => {
        if (data.success) {
          // 성공 시 storage 업데이트
          chrome.storage.local.get(["urlGroups"]).then((result) => {
            const urlGroups = result.urlGroups || [];
            const updatedUrlGroups = urlGroups.map((group: UrlGroup) => {
              if (group.problemId === numericProblemId) {
                return {
                  ...group,
                  items: [], // items를 비움
                };
              }
              return group;
            });
            chrome.storage.local.set({ urlGroups: updatedUrlGroups });
          });

          // 성공 모달 표시
          setIsSuccessModalOpen(true);
        } else {
          alert(data.errorMsg || "퀴즈 저장에 실패했습니다.");
        }
      },
      onError: (error) => {
        alert("퀴즈 저장에 실패했습니다.\n" + error);
      },
    }
  );

  const handleSave = () => {
    if (!selectedCollectionId) {
      alert("컬렉션을 선택해주세요.");
      return;
    }

    if (selectedIds.length === 0) {
      alert("최소 하나의 퀴즈를 선택해주세요.");
      return;
    }

    saveQuiz({
      quizIdList: selectedIds,
    });
  };

  const { mutate: createCollection, isPending: isCreatingCollection } =
    useApiMutation<CollectionResponse>(`/collection`, {
      onSuccess: (data) => {
        if (data.success) {
          // 생성한 컬렉션 이름을 저장
          const newName = newCollectionName.trim();

          // refetchCollection은 Promise를 반환하므로 then 사용
          refetchCollection().then((result) => {
            // 직접 result에서 최신 데이터 사용
            if (result.data?.data) {
              // 방금 생성한 컬렉션 찾기 (이름으로 비교)
              const newCollection = result.data.data.find((c) => c.name === newName);
              if (newCollection) {
                setSelectedCollectionId(newCollection.id);
              } else {
                // 이름으로 찾지 못하면 마지막 컬렉션 사용
                const lastCollection = result.data.data[result.data.data.length - 1];
                if (lastCollection) {
                  setSelectedCollectionId(lastCollection.id);
                }
              }
            }
          });

          setNewCollectionName("");
          setIsModalOpen(false);
        } else {
          alert(data.errorMsg || "컬렉션 생성에 실패했습니다.");
        }
      },
      onError: (error) => {
        alert("컬렉션 생성 중 오류가 발생했습니다.\n" + error);
      },
    });

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) {
      alert("컬렉션 이름을 입력해주세요.");
      return;
    }

    createCollection({ title: newCollectionName.trim() });
  };

  const openNewCollectionModal = () => {
    setIsModalOpen(true);
    setNewCollectionName("");
  };

  const handleNavigateToHome = () => {
    navigate("/");
  };

  const handleNavigateToCollection = () => {
    // 컬렉션 페이지로 이동
    window.open(`https://memozy.site/collection/${selectedCollectionId}`);
  };

  useEffect(() => {
    const loadProblem = async () => {
      try {
        // URL 그룹에서 problemId에 해당하는 그룹 찾기
        const result = await chrome.storage.local.get(["urlGroups"]);
        const urlGroups = result.urlGroups || [];

        const foundProblemGroup = urlGroups.find(
          (group: UrlGroup) => group.problemId === numericProblemId
        );

        if (foundProblemGroup) {
          setQuizSource(foundProblemGroup);
        } else {
          // 문제를 찾을 수 없는 경우
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

  const handleRequestAgain = () => {
    setIsNewProblemModalOpen(true);
  };

  useEffect(() => {
    if (quizData?.data) {
      setSelectedIds(quizData.data.map((quiz) => quiz.quizId));
    }
  }, [quizData]);

  // 문제 재생성 API 호출
  const { mutate: renewQuizzes, isPending: isRenewingQuizzes } = useApiMutation<
    { success: boolean; data: any },
    { quizIdList: number[]; quizTypes: string[] }
  >(`/quiz/questions/${problemId}/renew`, {
    onSuccess: (response) => {
      if (response.success) {
        setIsNewProblemModalOpen(false);
        // 성공 후 퀴즈 데이터 다시 불러오기
        window.location.reload();
      } else {
        alert("문제 재생성에 실패했습니다.");
      }
    },
    onError: () => {
      alert("문제 재생성 중 오류가 발생했습니다.");
    },
  });

  const handleRenewQuizzes = (selectedQuizIds: number[], selectedQuizTypes: string[]) => {
    renewQuizzes({
      quizIdList: selectedQuizIds,
      quizTypes: selectedQuizTypes,
    });
  };

  return (
    <div className="max-w-3xl mx-auto bg-level1 text-black p-5">
      <div className="flex items-center mt-2 mb-4">
        <img src="/icon48.png" alt="logo" className="w-10 h-10 mr-2" />
        <h1 className="text-3xl font-bold text-level6 m-0">문제 선정하기</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 min-w-100">
        <div className="w-full py-2 px-3 mb-4 border-b border-gray flex items-center">
          {quizSource?.favicon && (
            <img src={quizSource.favicon} alt="favicon" className="w-8 h-8 mr-3" />
          )}
          <span className="text-xl font-bold line-clamp-1">{quizSource?.title}</span>
          <div className="flex ml-auto items-center gap-2">
            <button
              className="flex flex-col text-xs w-14 h-13 px-1 rounded border bg-level2 border-level3 text-level6 hover:bg-level3 transition-all flex items-center justify-center"
              onClick={() => navigate("/")}
            >
              <span className="text-lg">🏠</span>
              <span className="text-base">홈</span>
            </button>
            <button
              className="flex flex-col text-xs w-14 h-13 px-1 rounded border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center"
              onClick={handleRequestAgain}
            >
              <span className="text-lg">🔄</span>
              <span className="text-base">재요청</span>
            </button>
          </div>
        </div>
        <div className="pl-5 mb-5">
          <div className="text-base font-semibold">
            총 퀴즈 수{" "}
            <span className="text-sm bg-gray-100 px-2 py-1 rounded-md">
              {quizData?.data?.length}
            </span>
          </div>
        </div>

        {quizLoading ? (
          <div className="text-center py-4">데이터를 불러오는 중...</div>
        ) : quizError ? (
          <div className="text-center py-4 text-red-500">데이터를 불러오는데 실패했습니다.</div>
        ) : quizData?.data && quizData.data.length > 0 ? (
          <>
            {quizData.data.map((quiz) => (
              <div
                key={quiz.quizId}
                className="w-full py-2 px-3 border border-light-gray rounded text-sm ml-5 mb-4 min-h-[60px] line-clamp-1 bg-gray-50 cursor-pointer"
                onClick={() => {
                  if (selectedIds.includes(quiz.quizId)) {
                    setSelectedIds(selectedIds.filter((id) => id !== quiz.quizId));
                  } else {
                    setSelectedIds([...selectedIds, quiz.quizId]);
                  }
                }}
              >
                <div className="font-medium mb-1">{quiz.type}</div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selectedIds.includes(quiz.quizId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds([...selectedIds, quiz.quizId]);
                      } else {
                        setSelectedIds(selectedIds.filter((id) => id !== quiz.quizId));
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
        <div className="flex w-full items-center justify-center flex-wrap">
          <span className="text-base font-medium flex-shrink-0">선택한 퀴즈를</span>
          <div className="relative ml-2 w-[30vw]">
            <Listbox
              value={selectedCollectionId}
              onChange={(value) => {
                if (value === -1) {
                  openNewCollectionModal();
                  setSelectedCollectionId(null);
                } else {
                  setSelectedCollectionId(value);
                }
              }}
            >
              <ListboxButton className="relative w-full cursor-default rounded-md bg-white py-1 pl-3 pr-10 text-left border border-light-gray text-sm h-8 focus:outline-none focus:ring-2 focus:ring-main focus:border-main">
                <span className="block truncate">
                  {selectedCollectionId === null
                    ? "컬렉션 선택"
                    : selectedCollectionId === -1
                      ? "새 컬렉션 생성하기"
                      : collectionData?.data?.find((c) => c.id === selectedCollectionId)?.name ||
                        "컬렉션 선택"}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-gray-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
                    />
                  </svg>
                </span>
              </ListboxButton>
              {collectionData?.data?.map((collection) => (
                <ListboxOption
                  key={collection.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? "bg-main text-white" : "text-gray-900"
                    }`
                  }
                  value={collection.id}
                >
                  {({ selected, active }) => (
                    <>
                      <span
                        className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                      >
                        {collection.name}
                      </span>
                      {selected ? (
                        <span
                          className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? "text-white" : "text-main"}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </>
                  )}
                </ListboxOption>
              ))}
              <ListboxOptions
                anchor="bottom"
                transition
                className="absolute z-10 mt-1 max-h-60 rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none transition ease-in duration-100 data-closed:opacity-0"
              >
                <ListboxOption
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? "bg-main text-white" : "text-gray-900"
                    }`
                  }
                  value={-1}
                >
                  {({ selected, active }) => (
                    <>
                      <span
                        className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                      >
                        새 컬렉션 생성하기
                      </span>
                      {selected ? (
                        <span
                          className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? "text-white" : "text-main"}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </>
                  )}
                </ListboxOption>
              </ListboxOptions>
            </Listbox>
          </div>
          <span className="ml-2 text-base font-medium flex-shrink-0">에 </span>
          <button
            className={`ml-3 flex flex-col text-base w-20 h-8 px-1 rounded border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center ${
              isSavingQuiz ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={handleSave}
            disabled={isSavingQuiz}
          >
            {isSavingQuiz ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>

      {/* 모달 창 */}
      {isModalOpen && (
        <div className="fixed inset-0 min-w-100 flex items-center justify-center bg-black/20 z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-4">새 컬렉션 생성</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="컬렉션 이름"
                className="w-full py-2 px-3 border border-light-gray rounded text-sm mb-4"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onSubmit={handleCreateCollection}
                maxLength={20}
              />
              <div className="absolute bottom-0 right-2 text-xs text-gray-400">
                {newCollectionName.length}/20
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="flex flex-col text-xs w-[60px] h-[40px] px-1 rounded border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center"
                onClick={() => setIsModalOpen(false)}
              >
                취소
              </button>
              <button
                className="flex flex-col text-xs w-[80px] h-[40px] px-1 rounded border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center"
                onClick={handleCreateCollection}
                disabled={isCreatingCollection}
              >
                {isCreatingCollection ? "생성 중..." : "생성하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 성공 모달 */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <div className="flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2 text-center">퀴즈 저장 성공!</h3>
            <p className="text-center text-gray-600 mb-6">
              선택한 퀴즈가 컬렉션에 성공적으로 저장되었습니다.
            </p>
            <div className="flex justify-center gap-3">
              <button
                className="flex flex-col text-xs w-[100px] h-[40px] px-1 rounded border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center"
                onClick={handleNavigateToHome}
              >
                익스텐션 홈으로
              </button>
              <button
                className="flex flex-col text-xs w-[100px] h-[40px] px-1 rounded border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center"
                onClick={handleNavigateToCollection}
              >
                컬렉션 확인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 문제 재생성 모달 */}
      {quizData?.data && (
        <NewProblemModal
          isOpen={isNewProblemModalOpen}
          onClose={() => setIsNewProblemModalOpen(false)}
          existingQuizs={quizData.data}
          onSubmit={handleRenewQuizzes}
          isSubmitting={isRenewingQuizzes}
        />
      )}
    </div>
  );
}
