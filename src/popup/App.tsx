import { useState, useEffect } from 'react';
import Toggle from './components/Toggle';
import StatusMessage from './components/StatusMessage';
import { useStorage } from '../hooks/useStorage';
import { useAuth } from '../hooks/useAuth';
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
    loading: storageLoading
  } = useStorage();

  const {
    isAuthenticated,
    authLoading,
    login,
    logout,
    authError,
    checkAuthStatus
  } = useAuth();

  const [statusMessage, setStatusMessage] = useState<StatusMessageState | null>(null);

  useEffect(() => {
    if (authError) {
      setStatusMessage({ type: 'error', message: authError });
    }
  }, [authError]);

  const handleSaveHtml = async () => {
    setStatusMessage(null);
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

  const handleLoginClick = () => {
    setStatusMessage(null);
    login();
  }

  const handleLogoutClick = async () => {
    setStatusMessage(null);
    await logout();
  }

  const loading = storageLoading || authLoading;

  if (authLoading) {
    return (
      <div className="w-72 flex flex-col items-center justify-center gap-4 bg-level1 text-level6 p-4 text-base min-h-[200px]">
        <h1 className="text-2xl font-extrabold text-main m-0">Memozy</h1>
         <div className="flex items-center justify-center gap-2 text-gray">
          <div className="w-4 h-4 border-2 border-gray/20 rounded-full border-t-main animate-spin"></div>
          <span>인증 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 flex flex-col gap-4 bg-level1 text-level6 p-4 text-base">
      <h1 className="text-2xl font-extrabold text-main m-0">Memozy</h1>

      {statusMessage && (
        <StatusMessage
          type={statusMessage.type}
          message={statusMessage.message}
          onClose={() => setStatusMessage(null)}
        />
      )}

      {isAuthenticated ? (
        <>
          <Toggle
            label="텍스트와 이미지 캡처"
            checked={isCapturing}
            onChange={toggleCapturing}
            disabled={loading}
          />

          <div className="text-gray leading-relaxed text-sm">
            활성화 하면 <span className="font-bold text-level5">드래그한 텍스트</span> 또는 <span className="font-bold text-level5">이미지</span>가 자동으로 캡처됩니다.
          </div>

          <button
            className="bg-level2 text-black border border-light-gray py-2 px-3 rounded text-sm hover:bg-level3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSaveHtml}
            disabled={loading}
          >
            현재 페이지 통째로 저장
          </button>

          <button
            className="bg-main text-white py-2.5 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={openHistoryPage}
            disabled={loading}
          >
            캡처 기록 보기
          </button>

          <button
            className="bg-gray-200 text-gray-700 py-2 px-3 rounded text-sm hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleLogoutClick}
            disabled={loading}
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <p className="text-center text-gray">
            서비스를 이용하기 위해서는<br/>구글 로그인이 필요합니다.
          </p>
          <button
            className="bg-main text-white py-2.5 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleLoginClick}
            disabled={loading}
          >
            Google 계정으로 로그인
          </button>
          
          {authError && !authLoading && (
             <button
               className="text-xs text-blue-500 hover:underline mt-1"
               onClick={checkAuthStatus}
             >
               다시 시도
             </button>
           )}
        </>
      )}
    </div>
  );
};