import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './graph.css';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GraphApp } from './GraphApp';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <GraphApp />
  </ErrorBoundary>,
);
