import React, { useState } from 'react';
import { CapturedItem, ImageContent } from '../../types';

interface CapturedItemCardProps {
  item: CapturedItem;
  onDelete: (id: number) => void;
  onDownload: (item: CapturedItem) => void;
  showUrl?: boolean; // URL 표시 여부 (옵션)
}

const CapturedItemCard: React.FC<CapturedItemCardProps> = ({ 
  item, 
  onDelete, 
  onDownload,
  showUrl = true // 기본값은 true
}) => {

  // 날짜 포맷팅
  const formatDate = (date: Date | string | any): string => {
    // 빈 객체인 경우 현재 시간 사용
    if (date && typeof date === 'object' && Object.keys(date).length === 0) {
      return '날짜 정보 없음';
    }
    
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '날짜 정보 없음';
    }
    return d.toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  
  // 추출된 콘텐츠 렌더링
  const renderExtractedContent = () => {
    if (!item.meta?.extractedContent) return null;
    
    const { content } = item.meta.extractedContent;
    
    if (!content) return null;
    
    return (
      <div className="extracted-content">
        <h4>추출된 콘텐츠</h4>
        <div className="content-section">
          <div className="content-text">{content}</div>
        </div>
      </div>
    );
  };
  
  // 내용 렌더링
  const renderContent = () => {
    switch (item.type) {
      case 'text':
        return (
          <div className="card-content text-sm">
            {item.content as string}
          </div>
        );
        
      case 'html':
        const htmlContent = item.content as string;
        const displayContent = htmlContent.length > 1000 
          ? `${htmlContent.substring(0, 1000)}...` 
          : htmlContent;
          
        return (
          <div className="card-content type-html">
            <div>{displayContent}</div>
            {renderExtractedContent()}
          </div>
        );
        
      case 'image':
        const imgContent = item.content as ImageContent;
        return (
          <div className="card-content type-image">
            <img 
              src={imgContent.dataUrl} 
              alt="캡처된 이미지" 
              title={item.pageTitle} 
            />
          </div>
        );
        
      default:
        return (
          <div className="card-content">
            지원되지 않는 콘텐츠 타입입니다.
          </div>
        );
    }
  };
  
  // 타입에 따른 아이콘 렌더링
  const renderTypeIcon = () => {
    switch (item.type) {
      case 'text':
        return '📝';
      case 'html':
        return '📄';
      case 'image':
        return '🖼️';
      default:
        return '📦';
    }
  };
  
  return (
    <div className="card flex flex-col gap-2 my-2 border-b border-light-gray pb-2">
      <div className="card-header">
          {showUrl && (
            <div className="card-meta text-base">
              {item.pageUrl}
            </div>
          )}
      </div>
      
      {renderContent()}
      
      <div className="card-footer flex justify-between items-center">
        <div className="flex gap-2">
          <span className="timestamp text-base">
            {formatDate(item.timestamp)}
          </span>
          
          <span className="item-type text-base">
            {item.type === 'text' ? '텍스트' : 
            item.type === 'html' ? 'HTML' : 
            item.type === 'image' ? '이미지' : '알 수 없음'}
          </span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onDownload(item)}
            className="bg-main text-white border-0 py-2 px-4 rounded hover:bg-blue-700 transition-colors font-medium text-sm"
            title="다운로드"
          >
            다운로드
          </button>
          
          <button 
            onClick={() => onDelete(item.id)}
            className="bg-error text-white border-0 py-2 px-4 rounded hover:bg-red-700 transition-colors font-medium text-sm"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapturedItemCard; 