import { useState, useEffect } from 'react';
import '../Global.css';

const ProblemCreateApp: React.FC = () => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [summaryId, setSummaryId] = useState('');
  const [problemFields, setProblemFields] = useState<string[]>(['', '', '', '', '', '']);

  // URL 파라미터 읽기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const titleParam = params.get('title');
    const summaryIdParam = params.get('summaryId');
    
    if (urlParam) setUrl(urlParam);
    if (titleParam) setTitle(titleParam);
    if (summaryIdParam) setSummaryId(summaryIdParam);
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleFieldChange = (index: number, value: string) => {
    const newFields = [...problemFields];
    newFields[index] = value;
    setProblemFields(newFields);
  };

  const handleSubmit = () => {
    // 문제 제출 로직 구현
    alert('문제가 생성되었습니다!');
  };

  return (
    <div className="max-w-3xl mx-auto bg-level1 text-black p-5">
      <header className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-level6 m-0">백준 코딩 테스트: 문제 만들기</h1>
        <button 
          className="bg-main text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          onClick={() => chrome.tabs.create({ url: 'history.html' })}
        >
          ← 캡처 기록으로 돌아가기
        </button>
      </header>

      <div className="bg-white rounded-lg shadow p-6">
        <input
          className="w-full py-2 px-3 border border-light-gray rounded text-base mb-4"
          type="text"
          placeholder="문제 제목을 입력하세요..."
          value={title}
          onChange={handleTitleChange}
        />

        {problemFields.map((field, index) => (
          <textarea
            key={index}
            className="w-full py-2 px-3 border border-light-gray rounded text-sm mb-4 min-h-[60px]"
            placeholder={`문제 내용 ${index + 1}을 입력하세요...`}
            value={field}
            onChange={(e) => handleFieldChange(index, e.target.value)}
          />
        ))}

        <div className="flex justify-between mt-4">
          <button
            className="bg-gray-200 text-black py-2 px-4 rounded hover:bg-gray-300 transition-colors text-sm"
            onClick={() => window.history.back()}
          >
            검색 화면 이동
          </button>
          <button
            className="bg-main text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            onClick={handleSubmit}
          >
            문제 생성
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProblemCreateApp;