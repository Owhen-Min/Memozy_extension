import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CapturedItem } from '../../types';

export default function SummaryView() {
  const { summaryId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CapturedItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const result = await chrome.storage.local.get(['savedItems']);
        const items = result.savedItems || [];
        const foundSummary = items.find((item: CapturedItem) => item.summaryId === summaryId);
        
        if (foundSummary) {
          setSummary(foundSummary);
        } else {
          // 요약을 찾을 수 없는 경우
          alert('요약을 찾을 수 없습니다.');
          navigate('/');
        }
      } catch (error) {
        console.error('요약 로드 오류:', error);
        alert('요약을 불러오는 중 오류가 발생했습니다.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [summaryId, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-6 h-6 border-2 border-gray/20 rounded-full border-t-main animate-spin"></div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto p-5">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">요약 보기</h1>
        <button
          className="bg-main text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          onClick={() => navigate('/')}
        >
          목록으로 돌아가기
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-xl font-semibold mb-3">{summary.pageTitle}</h2>
        <div className="text-gray-600 mb-4">
          <a href={summary.pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            원본 페이지 보기
          </a>
        </div>
        <div className="prose max-w-none">
          {/* 여기에 요약 내용을 표시 */}
        </div>
      </div>
    </div>
  );
} 