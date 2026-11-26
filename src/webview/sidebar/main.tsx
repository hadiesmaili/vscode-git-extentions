import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './sidebar.css';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SidebarApp } from './SidebarApp';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <SidebarApp />
  </ErrorBoundary>,
);
