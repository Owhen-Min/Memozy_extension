import { useState } from "react";
import { Quiz } from "../../views/ProblemView";
import { useModal } from "../../../context/ModalContext";
interface NewProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingQuizs: Quiz[];
  onSubmit: (selectedQuizIds: number[], selectedQuizTypes: string[]) => void;
  isSubmitting?: boolean;
}

const QUIZ_TYPES = [
  { id: "사지선다", name: "사지선다" },
  { id: "OX퀴즈", name: "OX퀴즈" },
];

export default function NewProblemModal({
  isOpen,
  onClose,
  existingQuizs,
  onSubmit,
  isSubmitting = false,
}: NewProblemModalProps) {
  const [selectedQuizIds, setSelectedQuizIds] = useState<number[]>([]);
  const [selectedQuizTypes, setSelectedQuizTypes] = useState<string[]>([]);
  const { openModal } = useModal();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedQuizIds.length === 0) {
      openModal(
        <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
          <h1 className="text-2xl font-bold text-center mb-4">재생성할 문제를 선택해주세요.</h1>
        </div>,
        { closeable: true }
      );
      return;
    }

    if (selectedQuizTypes.length === 0) {
      openModal(
        <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
          <h1 className="text-2xl font-bold text-center mb-4">생성할 문제 유형을 선택해주세요.</h1>
        </div>,
        { closeable: true }
      );
      return;
    }

    onSubmit(selectedQuizIds, selectedQuizTypes);
  };

  const toggleQuizId = (quizId: number) => {
    setSelectedQuizIds((prev) =>
      prev.includes(quizId) ? prev.filter((id) => id !== quizId) : [...prev, quizId]
    );
  };

  const toggleQuizType = (type: string) => {
    setSelectedQuizTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const selectAllQuizIds = () => {
    setSelectedQuizIds([...existingQuizs.map((quiz) => quiz.quizId)]);
  };

  const deselectAllQuizIds = () => {
    setSelectedQuizIds([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">문제 재생성</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block font-medium mb-2">남길 문제 선택</label>
            <div className="flex justify-end mb-2 space-x-2">
              <button
                type="button"
                onClick={selectAllQuizIds}
                className="text-sm text-blue-600 hover:underline"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={deselectAllQuizIds}
                className="text-sm text-gray-600 hover:underline"
              >
                선택 해제
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              {existingQuizs.map((quiz) => (
                <div
                  key={quiz.quizId}
                  className="flex items-center mb-1"
                  onClick={() => {
                    toggleQuizId(quiz.quizId);
                  }}
                >
                  <input
                    type="checkbox"
                    id={`quiz-${quiz.quizId}`}
                    checked={selectedQuizIds.includes(quiz.quizId)}
                    onChange={() => toggleQuizId(quiz.quizId)}
                    className="mr-2"
                  />
                  <label htmlFor={`quiz-${quiz.content}`} className="cursor-pointer">
                    {quiz.content}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-2">생성할 문제 유형</label>
            <div className="space-y-2">
              {QUIZ_TYPES.map((type) => (
                <div key={type.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`type-${type.id}`}
                    checked={selectedQuizTypes.includes(type.id)}
                    onChange={() => toggleQuizType(type.id)}
                    className="mr-2"
                  />
                  <label htmlFor={`type-${type.id}`} className="cursor-pointer">
                    {type.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-main text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={
                isSubmitting || selectedQuizIds.length === 0 || selectedQuizTypes.length === 0
              }
            >
              {isSubmitting ? "재생성 중..." : "문제 재생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
