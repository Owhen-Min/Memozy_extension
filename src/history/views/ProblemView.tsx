import { useNavigate, useParams } from 'react-router-dom';
import '../../Global.css';
import { CapturedItem } from '../../types';
import { useEffect, useState } from 'react';

export default function ProblemView() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<CapturedItem | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadProblem = async () => {
      try {
        const result = await chrome.storage.local.get(['savedItems']);
        const items = result.savedItems || [];
        const foundProblem = items.find((item: CapturedItem) => item.problemId === problemId);
        
        if (foundProblem) {
          setProblem(foundProblem);
        } else {
          // 요약을 찾을 수 없는 경우
          alert('요약을 찾을 수 없습니다.');
          navigate('/');
        }
      } catch (error) {
        console.error('문제 로드 오류:', error);
        alert('문제를 불러오는 중 오류가 발생했습니다.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    loadProblem();
  }, [problemId, navigate]);

  // TODO: 실제로는 problemId를 사용하여 문제 데이터를 가져와야 합니다
  const mockProblem = {
    title: '문제 제목',
    fields: [
      '문제 내용 1',
      '문제 내용 2',
      '문제 내용 3',
      '문제 내용 4',
      '문제 내용 5',
      '문제 내용 6'
    ]
  };

  return (
    <div className="max-w-3xl mx-auto bg-level1 text-black p-5">
      <h1 className="text-2xl font-bold text-level6 m-0">문제 만들기</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="w-full py-2 px-3 border border-light-gray rounded text-base mb-4 bg-gray-50">
          {problem?.pageTitle}
        </div>

        {mockProblem.fields.map((field, index) => (
          <div
            key={index}
            className="w-full py-2 px-3 border border-light-gray rounded text-sm mb-4 min-h-[60px] bg-gray-50"
          >
            {field}
          </div>
        ))}

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