/**
 * 主應用組件
 * 參考Taoli Tools設計理念，提供專業的交易界面
 */

import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, message } from 'antd';
import { useDispatch } from 'react-redux';

import AppHeader from './components/AppHeader';
import AppSider from './components/AppSider';
import Dashboard from './pages/Dashboard';
import ArbitragePage from './pages/ArbitragePage';
import TwapPage from './pages/TwapPage';
import SettingsPage from './pages/SettingsPage';
import { connectWebSocket } from './services/websocket';
import { apiService } from './services/api';
import { AppDispatch } from './store';
import { updateExchanges } from './store/slices/systemSlice';

const { Content } = Layout;

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // 載入交易所信息
    const loadExchanges = async () => {
      try {
        const response = await apiService.getExchanges();
        if (response.data) {
          dispatch(updateExchanges(response.data));
        }
      } catch (error) {
        console.error('載入交易所信息失敗:', error);
      }
    };

    loadExchanges();

    // 連接WebSocket
    const cleanup = connectWebSocket(dispatch);

    // 顯示歡迎消息
    message.success('歡迎使用雙腿套利交易系統！');

    // 清理函數
    return () => {
      cleanup();
    };
  }, [dispatch]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Layout>
        <AppSider />
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/arbitrage" element={<ArbitragePage />} />
              <Route path="/twap" element={<TwapPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
