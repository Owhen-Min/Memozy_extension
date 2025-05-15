# Memozy - 기억을 쉽게 정착시켜주는 학습 도구

Memozy는 웹 브라우저에서 학습 내용을 쉽게 저장하고 관리할 수 있는 크롬 확장 프로그램입니다.

## 주요 기능

- 웹 페이지의 내용을 드래그하여 쉽게 저장
- 마크다운 형식으로 저장된 내용 관리
- 학습 내용의 효율적인 정리와 검색
- OAuth2를 통한 안전한 사용자 인증

## 기술 스택

- React 19
- TypeScript
- TailwindCSS
- Webpack
- Chrome Extension Manifest V3

## 설치 방법

1. Chrome 웹 스토어에서 Memozy 확장 프로그램 설치
2. 또는 개발자 모드에서 로컬 설치:
   ```bash
   git clone [repository-url]
   cd memozy-extension
   npm install
   npm run build
   ```

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# 프로덕션 빌드
npm run build
```

## 프로젝트 구조

```
memozy-extension/
├── src/              # 소스 코드
├── public/           # 정적 파일
├── dist/            # 빌드 결과물
├── manifest.json    # 크롬 확장 프로그램 설정
└── package.json     # 프로젝트 의존성 및 스크립트
```

## 라이선스

ISC License

## 버전

현재 버전: 1.0.2 