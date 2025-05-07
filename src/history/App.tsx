import { Routes, Route } from "react-router-dom";
import History from "./History";
import SummaryView from "./views/SummaryView";
import ProblemView from "./views/ProblemView";
import { QueryProvider } from "../providers/QueryProvider";

function App() {
  return (
    <QueryProvider>
      <Routes>
        <Route path="/" element={<History />} />
        <Route path="/summary/:summaryId" element={<SummaryView />} />
        <Route path="/problem/:problemId" element={<ProblemView />} />
      </Routes>
    </QueryProvider>
  );
}

export default App;
