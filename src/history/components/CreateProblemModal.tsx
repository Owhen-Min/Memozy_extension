import { useState } from "react";
import { CapturedItem } from "../../types";

interface CreateProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProblemCreationData) => void;
  item: CapturedItem;
}

export interface ProblemCreationData {
  quizCount: number;
  quizTypes: string[];
}

export default function CreateProblemModal({
  isOpen,
  onClose,
  onSubmit,
  item,
}: CreateProblemModalProps) {
  const [quizCount, setQuizCount] = useState<number>(5);
  const [quizTypes, setQuizTypes] = useState<string[]>(["사지선다"]);

  if (!isOpen) return null;

  const handleQuestionTypeChange = (type: string) => {
    setQuizTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      quizCount,
      quizTypes,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">문제 생성 설정</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-lg font-medium mb-2">생성할 문제 수</label>
            <select
              value={quizCount}
              onChange={(e) => setQuizCount(Number(e.target.value))}
              className="w-full p-2 text-base border rounded"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4 text-base">
            <label className="block text-lg font-medium mb-2">문제 유형</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                // onClick={() => handleQuestionTypeChange("사지선다")}
                className={`px-3 py-1 rounded border ${
                  quizTypes.includes("사지선다")
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                객관식
              </button>
              <button
                type="button"
                disabled={true}
                title="추후 업데이트 예정입니다."
                onClick={() => handleQuestionTypeChange("OX퀴즈")}
                className={`px-3 py-1 rounded border disabled:opacity-50 ${
                  quizTypes.includes("OX퀴즈")
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                OX 문제
              </button>
              <button
                type="button"
                disabled={true}
                title="추후 업데이트 예정입니다."
                onClick={() => handleQuestionTypeChange("단답형")}
                className={`px-3 py-1 rounded border disabled:opacity-50 ${
                  quizTypes.includes("단답형")
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                단답형
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={handleSubmit}
            >
              생성하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
