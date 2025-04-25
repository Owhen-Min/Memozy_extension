import { useState } from 'react';
import Toggle from './components/Toggle';
import StatusMessage from './components/StatusMessage';
import { useStorage } from '../hooks/useStorage';
import { NotificationType } from '../types';
import '../Global.css';

interface StatusMessageState {
  type: NotificationType;
  message: string;
}

export default function App() {
  const { 
    isCapturing, 
    toggleCapturing, 
    saveHtml,
    openHistoryPage,
    loading
  } = useStorage();
  
  const [statusMessage, setStatusMessage] = useState<StatusMessageState | null>(null);

  const handleSaveHtml = async () => {
    try {
      const result = await saveHtml();
      if (result.success) {
        setStatusMessage({
          type: 'success',
          message: '자료가 성공적으로 저장되었습니다'
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: result.error || '자료 저장 중 오류가 발생했습니다'
        });
      }
    } catch (error: any) {
      console.error('자료 저장 중 오류:', error);
      setStatusMessage({
        type: 'error',
        message: error.message || '자료 저장 중 오류가 발생했습니다'
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 bg-level1 text-level6 p-4 text-base">
      <h1 className="text-2xl font-bold text-main m-0">자료 저장</h1>
      
      <Toggle 
        label="텍스트와 이미지 캡처" 
        checked={isCapturing} 
        onChange={toggleCapturing}
        disabled={loading}
      />
      
      <div className="text-sm text-gray leading-relaxed">
        활성화 하면 <span className="font-bold text-level5">드래그한 텍스트</span>또는 <span className="font-bold text-level5">이미지</span>가 자동으로 캡처됩니다.
      </div>
      
      <button 
        className="bg-level2 text-black border border-light-gray py-2 px-3 rounded text-sm hover:bg-level3 transition-all"
        onClick={handleSaveHtml}
        disabled={loading}
      >
        통째로 저장
      </button>       
      {statusMessage && (
        <StatusMessage
          type={statusMessage.type}
          message={statusMessage.message}
          onClose={() => setStatusMessage(null)}
        />
      )}
      
      <button 
        className="bg-main text-white py-2.5 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
        onClick={openHistoryPage} 
        disabled={loading}
      >
        캡처 기록 보기
      </button>
    </div>
  );
};