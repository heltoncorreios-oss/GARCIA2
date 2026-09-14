import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginView } from './components/auth/LoginView';
import { MainAppLayout } from './components/layout/MainAppLayout';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota Pública de Autenticação */}
          <Route path="/login" element={<LoginView />} />

          {/* Rotas Protegidas - Acesso Exclusivo com Sessão Ativa */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/saldo-consolidado"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/movimentacoes"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/lancamentos"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/importar"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/importacao"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/relatorios"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/database"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/usuarios"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/entradas"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />
          <Route
            path="/saidas"
            element={
              <AuthGuard>
                <MainAppLayout />
              </AuthGuard>
            }
          />

          {/* Redirecionamento Padrão */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
