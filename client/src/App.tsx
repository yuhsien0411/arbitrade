/**
 * 主應用組件
 * 參考Taoli Tools設計理念，提供專業的交易界面
 */

import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, App as AntdApp } from 'antd';
import { useDispatch } from 'react-redux';

import AppHeader from './components/AppHeader';
import AppSider from './components/AppSider';
import Dashboard from './pages/Dashboard';
import ArbitragePage from './pages/ArbitragePage';
import TwapPage from './pages/TwapPage';
import SettingsPage from './pages/SettingsPage';
import { connectWebSocket } from './services/websocket';
import logger from './utils/logger';
import { apiService } from './services/api';
import { AppDispatch } from './store';
import { updateExchanges } from './store/slices/systemSlice';
import storage from './utils/storage';
import { setMonitoringPairs, setOpportunities, clearExecutionHistory } from './store/slices/arbitrageSlice';

const { Content } = Layout;

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = AntdApp.useApp();

  useEffect(() => {
    // 載入交易所信息（延遲載入，避免初始請求）
    const loadExchanges = async () => {
      try {
        const response = await apiService.getExchanges();
        if (response.data) {
          dispatch(updateExchanges(response.data));
        }
      } catch (error) {
        logger.error('載入交易所信息失敗', error, 'App');
      }
    };

    // 延遲 2 秒載入，避免初始頁面載入時的請求
    const timer = setTimeout(loadExchanges, 2000);

    // 連接WebSocket
    const cleanup = connectWebSocket(dispatch);

    // 顯示歡迎消息
    message.success('歡迎使用雙腿套利交易系統！');

    // 清理函數
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [dispatch, message]);

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
