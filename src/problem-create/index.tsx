import { createRoot } from 'react-dom/client';
import ProblemCreateApp from './ProblemCreateApp';
import '../Global.css';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<ProblemCreateApp />);