import { useState } from 'react';
import { CapturedItem } from '../../types';

interface CreateProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProblemCreationData) => void;
  item: CapturedItem;
}

export interface ProblemCreationData {
  numProblems: number;
  contentTypes: string[];
  questionTypes: string[];
}

export default function CreateProblemModal({ isOpen, onClose, onSubmit, item }: CreateProblemModalProps) {
  const [numProblems, setNumProblems] = useState<number>(5);
  const [contentTypes, setContentTypes] = useState<string[]>(['text', 'html']);
  const [questionTypes, setQuestionTypes] = useState<string[]>(['multiple-choice', 'ox']);

  if (!isOpen) return null;

  const handleContentTypeChange = (type: string) => {
    setContentTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleQuestionTypeChange = (type: string) => {
    setQuestionTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      numProblems,
      contentTypes,
      questionTypes
    });
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">문제 생성 설정</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-lg font-medium mb-2">
              생성할 문제 수
            </label>
            <select
              value={numProblems}
              onChange={(e) => setNumProblems(Number(e.target.value))}
              className="w-full p-2 text-base border rounded"
            >
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          <div className="mb-4 text-base">
            <label className="block text-lg font-medium mb-2">
              문제 유형
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={questionTypes.includes('multiple-choice')}
                  onChange={() => handleQuestionTypeChange('multiple-choice')}
                  className="mr-2"
                />
                객관식
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={questionTypes.includes('ox')}
                  onChange={() => handleQuestionTypeChange('ox')}
                  className="mr-2"
                />
                OX 문제
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={questionTypes.includes('short-answer')}
                  onChange={() => handleQuestionTypeChange('short-answer')}
                  className="mr-2"
                />
                단답형
              </label>
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
            >
              생성하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 